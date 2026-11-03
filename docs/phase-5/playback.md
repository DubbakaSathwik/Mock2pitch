# Playback of your recordings after submitting

After "Submit for feedback" the report page lets the student play back each recorded slide (open a slide's panel, press play).

- **Where the audio lives:** only in the browser tab's memory (the same in-memory `recordingStore` used by Mic check, Room and Review). Nothing new is stored on a server, in IndexedDB or in localStorage. The server still deletes the uploaded audio as soon as the report is generated, exactly as before, so the Terms/Privacy promise about server-side audio is unchanged.
- **How long it works:** until the student leaves the report. The report page asks the store to drop its session's clips shortly after it unmounts (delayed and cancellable, so React StrictMode and quick back-and-forth do not lose them). `MicReleaser` keeps clips while on `/reports/*` and resets everything once the student is anywhere else outside `/session/*`.
- **When it is not available:** after a refresh, on another device, or when opening an old report from History. Those reports show no playback controls and no note.
- **UI:** an info note ("They are only on this device and disappear when you leave this report.") above the slide list, and a play/stop button with the clip length in each recorded slide's panel (`data-testid="playback-N"`). The Review screen's wording now says the audio is deleted from our servers and can still be played back on the report until you leave it.
