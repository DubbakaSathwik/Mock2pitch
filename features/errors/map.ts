// Error code → UI. Every backend code (docs/phase-1/api-contracts.md) has an entry; the Record type makes a missing code a compile error.
import { ERROR_CODES, type ErrorCode } from "@/lib/data/errors";

export type ErrorUi =
  | { kind: "route"; to: string }
  | { kind: "inline"; title: string; body: string; retry?: boolean };

type D = Record<string, unknown>;
const inline = (title: string, body: string, retry = false): ErrorUi => ({ kind: "inline", title, body, retry });
const route = (to: string): ErrorUi => ({ kind: "route", to });
const busy = inline("Our AI is busy right now", "Try again in a minute. Nothing was used up.", true);
const generic = inline("Something went wrong", "Please try again.", true);
const slideNo = (d: D) => (typeof d.slide_index === "number" ? d.slide_index + 1 : null);

export const ERROR_UI: Record<ErrorCode, (d: D) => ErrorUi> = {
  not_authenticated: () => route("/sign-in"),
  policy_not_accepted: () => route("/onboarding/terms"),
  profile_incomplete: () => route("/onboarding/profile"),
  blocked: () => route("/paused"),
  is_admin: () => route("/admin"),
  forbidden: () => inline("You don't have access to that", "Go back and try something else."),
  daily_limit_reached: () => route("/limit"),
  not_pdf: () => inline("That file isn't a PDF", "We can only read PDF files. Using PowerPoint? Choose File → Save as PDF, then upload it here."),
  too_large: () => inline("That PDF is larger than 5 MB", "Export it again with a smaller size, then upload it."),
  too_many_pages: (d) => inline(`That deck has ${d.page_count ?? "too many"} slides`, `Decks can have up to ${d.max_pages ?? 10} slides. Remove a few and upload again.`),
  encrypted_pdf: () => inline("We couldn't open this PDF", "It looks password protected. Remove the password, then upload it again."),
  corrupt_pdf: () => inline("We couldn't open this PDF", "The file looks damaged. Export it again from your slides and upload the new file."),
  size_mismatch: () => inline("Upload failed", "The file didn't arrive in full. Check your connection and try again.", true),
  upload_missing: () => inline("Upload failed", "We didn't receive the file. Check your connection and try again.", true),
  upload_failed: () => inline("Upload failed", "The upload was interrupted. Check your connection and try again.", true),
  deck_in_progress: () => inline("Finish your current deck first", "Another deck is still being read. Wait for it to finish, then start a new one."),
  images_missing: () => inline("Some slide images didn't upload", "We'll prepare and upload them again.", true),
  not_jpeg: () => inline("A slide image couldn't be read", "We'll prepare and upload it again.", true),
  image_too_large: () => inline("A slide image was too large", "We'll prepare and upload it again.", true),
  AI_BUSY: () => busy,
  ai_unavailable: () => busy,
  processing_failed: () => generic,
  report_invalid: () => inline("We couldn't finish your report", "That sometimes happens. Try again; your recordings are safe.", true),
  analysis_failed: () => generic,
  analysis_stalled: () => generic,
  max_attempts: () => inline("We couldn't finish this report", "Please practise again. Your session wasn't counted twice."),
  audio_invalid: (d) => inline("One recording couldn't be read", slideNo(d) ? `Re-record slide ${slideNo(d)}, then submit again.` : "Re-record that slide, then submit again.", false),
  analysis_in_progress: () => inline("Still analysing your previous session", "Wait for that report, then submit again."),
  clip_missing: (d) => inline("A recording didn't upload", slideNo(d) ? `Slide ${slideNo(d)} is missing. Try again.` : "Try again.", true),
  clip_too_large: () => inline("That recording is too long", "The longest one slide can be is 10:00. Re-record it."),
  clip_empty: () => inline("That recording is empty", "Re-record the slide."),
  invalid_slide_index: () => generic,
  duplicate_slide_index: () => generic,
  audio_expired: () => inline("This session has expired", "Start a new practice to try again."),
  no_clips: () => inline("Nothing to submit yet", "Record at least one slide first."),
  invalid_state: () => inline("That isn't possible right now", "Reload the page and try again.", true),
  invalid_minutes: () => inline("Choose between 1 and 20 minutes", "Then continue."),
  not_found: () => inline("We couldn't find that", "It may have been removed."),
  invalid_stars: () => inline("Pick a rating", "Choose between 1 and 5 stars."),
  comment_too_long: () => inline("That comment is too long", "Keep it under 500 characters."),
  already_rated: () => inline("You've already rated this report", "Thank you for your feedback."),
  not_latest_policy: () => inline("A newer version was published", "Reload to read it, then accept."),
  misconfigured: () => inline("The service isn't set up yet", "Please let the owner know."),
  invalid_label: () => inline("Use a label like v4.0", "Letters other than v, numbers and a dot aren't allowed."),
  invalid_body: () => inline("Both texts are required", "Add the Terms and the Privacy Policy before publishing."),
  label_not_increasing: () => inline("That label comes too early", "Use a version after the current one."),
  cannot_block_admin: () => inline("The owner can't be blocked", "Choose a student."),
  network_error: () => inline("We couldn't reach the server", "Check your connection and try again.", true),
  unknown: () => generic,
};

export function errorUi(code: ErrorCode, details: D = {}): ErrorUi { return (ERROR_UI[code] ?? ERROR_UI.unknown)(details); }
export const ALL_ERROR_CODES = ERROR_CODES;
