# Filler-word detection on the real ASR (Phase 3)

**Question:** does NVIDIA Parakeet (`parakeet-tdt-0.6b-v2`) keep "um / uh" in its transcripts? That decides whether filler counts are
trustworthy or only a rough hint.

## What was measured

Only **synthetic speech** has been run through the real stack. `tests/fixtures/clip-fillers-synthetic.wav` (5.58 s, 16 kHz mono, flite
voice `slt`) was transcribed 6 times by the deployed pipeline, as the browser would send it (fake microphone fed with that file).

Script spoken: *"So um we built the system and uh it is like really fast. Basically you know it actually works and we are happy with it."*
(planted fillers: `um`, `uh`, `like`, `basically`, `you know`, `actually`). The browser's fake microphone loops that file and the
practice room records for about 5.5 s, so each recording is a differently-cut window of the loop (that is why the transcripts start
and end at different words).

| Session / slide | Transcript returned by Parakeet | Fillers counted |
|---|---|---|
| NEW `20e56423` slide 0 | "Actually, it works, and we are happy with it. So, and we built the system, and it is like really fast." | actually, like (2) |
| NEW `20e56423` slide 1 | "You know, it actually works, and we are happy with it. So, and we built the system, and it is like really fast." | actually, like, you know (3) |
| NEW `20e56423` slide 2 | "Basically, you know, it actually works, and we are happy with it. So, and we built the system, and it is." | actually, basically, you know (3) |
| NEW `c450c2dd` slide 0 | "Know it actually works, and we are happy with it. So, and we built the system, and it is like really fast." | actually, like (2) |
| A `0613a88f` slide 0 | "You know, it actually works, and we are happy with it. So, and we built the system, and it is like really fast." | actually, like, you know (3) |
| A `78066f48` slide 0 | "Basically you know it actually works and we are happy with it. So and we built the system and it is like" | actually, basically, like, you know (4) |

## Findings

1. **"um" and "uh" never appear in any transcript** (0 of 6 clips, although the script contains both). Parakeet's output is *verbatim-clean*: it drops
   hesitation sounds. Counted fillers are only the **lexical** ones (`actually`, `basically`, `like`, `you know`, …).
2. Lexical fillers are found, but the count varies with the recording window and with what the model keeps (2–4 per clip here; one
   transcript starts "Know it actually works", dropping "you"). Counting itself (`countFillers`) is deterministic on the text it is given.
3. The synthetic voice is not a human; it exercises the plumbing (upload → ASR → word timings → counts → report → UI), not accuracy.

## What the product does about it (no backend change)

* The UI already presents the count as "Filler words" with the words listed, and the report prompt receives the counts as data. Scoring
  weights are unchanged (decided in Phase 1).
* **Recommendation for the owner:** keep the feature, but do not market it as "um/uh detection". Wording in the report/FAQ should say
  "filler words like *basically, actually, you know*". If hesitation sounds matter, a different ASR configuration/model (verbatim mode) is
  a Phase 4 decision.

## Still open

A **human** recording (with real "um/uh") has not been run: it needs a person with a microphone. Steps for the owner (2 minutes, costs
1 ASR call and 1 report): sign in as a student, upload any short deck, record 20 s on slide 1 saying "um … so, uh, basically, you know,
this is, like, my project", submit, and read the report's filler panel. Expected given the findings above: the lexical words are
counted, "um/uh" are not.
