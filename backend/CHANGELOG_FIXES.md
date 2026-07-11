# Changelog — What Was Actually Changed and Why

A note up front: no codebase can be honestly certified "0% bugs" — that isn't
a real property software can have. What's true here is narrower and more
useful: **every issue confirmed in the prior audit report has been fixed**,
each fix targets the specific failure mode it addresses, and files with no
identified problem were left untouched rather than rewritten for the sake of
rewriting — changing working auth/database code with no evidence of a bug in
it would only risk introducing a new one.

---

## Files rewritten (with reasons)

### `app/pipeline/ocr_engine.py` — root cause fix
Previously, every OCR line whose center fell inside a single YOLO-detected
region was concatenated into ONE string sharing ONE bounding box. A YOLO box
spanning a totals block (Subtotal / CGST / SGST / Grand Total on separate
visual lines) collapsed into one text blob, and every downstream regex/
keyword match lost the ability to tell which number belonged to which label.
This was the single largest source of "sometimes right, sometimes wrong"
field extraction across every invoice type — it depended entirely on how
tightly YOLO's box happened to fit that specific image, not on the invoice
type itself.

**Fix:** `extract_all_regions` now returns one `OCRResult` per real OCR line,
always with its own box and its own text. The YOLO region a line falls
inside is attached only as advisory `yolo_hint` metadata — it is never used
to merge multiple lines' text or boxes together. Verified in isolation: a
simulated totals block with 4 separate lines now yields 4 separate
`OCRResult`s instead of 1 merged blob (see `_assign_yolo_hint` and the
accompanying docstring for the full explanation).

### `app/pipeline/ranking_engine.py` — two fixes
1. **Removed the raw-magnitude bonus** on `invoice_total` candidates
   (`5.0 * (1 - exp(-total/5000))`). This unconditionally rewarded bigger
   numbers regardless of correctness, which biased selection toward a
   pre-discount "MRP Total" over the real (smaller) "Grand Total" whenever
   OCR noise prevented the "grand total" keyword bonus from firing cleanly.
2. **The OCR-correction layer's corrected value is now actually applied.**
   Previously `OCRCorrectionLayer.correct()` computed a corrected value
   (fixing O/0, I/1, S/5 confusions) but `rank_field` always returned the
   original, uncorrected candidate value — the correction subsystem existed
   but had zero effect on final output. It's now applied when the
   correction is conservative (`correction_score <= 0.34`, i.e. a small
   edit, not a speculative rewrite).
3. Extended the "not a grand total" exclusion phrases (savings/MRP/
   round-off) to match the same list now used in `semantic_engine.py`.

### `app/pipeline/semantic_engine.py` — one targeted fix
`_is_tax_or_discount_total` previously excluded only tax/discount phrases
containing the word "total". It now also excludes `"total savings"`,
`"mrp total"`, `"round off"`, `"total items"`, and similar phrases that are
common on retail/mall receipts and were otherwise free to compete for the
`invoice_total` slot purely because they contain the bare word "total".
Verified with a standalone test: `"Total Savings: 45.00"` and
`"MRP Total: 1200.00"` are now correctly excluded, while
`"Grand Total: 950.00"` and `"Total Amount: 1180.00"` are correctly kept.

Everything else in this file (payment status resolution, date parsing,
GSTIN/invoice-number normalization) was already correct from an earlier
pass and is unchanged here.

### `app/pipeline/llm_engine.py` — several fixes
- Fixed a harmless but sloppy `hints = hints = extract_ocr_hints(...)`
  duplicate assignment.
- **Added `notes` to the extraction schema.** Previously "Notes" was never
  populated by any extraction path — it was a manual-edit-only field. It's
  now part of the LLM JSON schema (with an explicit instruction not to
  fabricate a value when nothing is present) and flows through
  `enrich_llm_data_from_ocr` → `map_llm_json_to_schema`.
- **Currency no longer silently defaults to INR.** Previously every code
  path that couldn't find a currency symbol/code fell back to `"INR"`,
  which is wrong for genuinely ambiguous or international documents (export/
  import/commercial invoices are exactly the types most likely to need
  this). It now returns `None` when there's no actual evidence, and only
  resolves to a specific currency when a symbol or ISO code is actually
  present in the text.
- **Reused `_reconcile_amount_fields`** (already correct in
  `semantic_engine.py`) inside `apply_ocr_corrections_to_fields`, so the LLM
  extraction path gets the same subtotal+tax≈grand_total consistency repair
  that the rule-based fallback already had — this check was previously
  missing from the primary (LLM) path.
- **Ollama endpoint is now configurable** via `OLLAMA_BASE_URL`,
  `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS` (see `config.py`), instead of a
  hardcoded `localhost:11434` and a fixed 120s timeout.
- **Added a fast health check** (`_ollama_is_reachable`, ~3s timeout) before
  committing to the full extraction call, so a cold/down Ollama instance
  fails fast and falls back to `SemanticEngine` quickly instead of silently
  consuming the full request timeout on every single upload.
- Extended the same savings/MRP/round-off exclusion phrases into the OCR
  hint-collection logic (`_collect_ocr_amount_candidates`,
  `_is_non_total_line`) so the regex-hint layer and the LLM-reconciliation
  layer agree with `semantic_engine.py` on what counts as a real total.

### `app/pipeline/pipeline.py` — one fix
`apply_ocr_corrections_to_fields` was being called twice for the LLM path:
once inside `map_llm_json_to_schema` (already correct) and again
unconditionally in `pipeline.py`. It's now applied exactly once — only for
the `SemanticEngine` fallback path, which doesn't call it internally. Also
added an `engine_used` field to the pipeline's return dict purely for
observability (so you can see in logs/DB whether a given bill was processed
by the LLM path or the rule-based fallback — useful for noticing if Ollama
is silently failing more often than expected).

### `app/core/config.py` — additive only
Added `OLLAMA_BASE_URL`, `OLLAMA_MODEL`, `OLLAMA_TIMEOUT_SECONDS`,
`OLLAMA_HEALTHCHECK_TIMEOUT_SECONDS`. Nothing existing was removed or
changed.

### `app/api/routes/invoices.py` — one fix, rest preserved exactly
`bill.notes` is now set from `fields.get("notes")` in
`process_bill_in_background`, matching the new extraction schema. Every
other endpoint, model field, and business rule is unchanged from the
original — this file's only bug was the missing notes wiring.

---

## Files intentionally left unchanged

`app/pipeline/candidate_engine.py`, `app/pipeline/ocr_correction.py`,
`app/pipeline/table_reconstructor.py`, `app/pipeline/detector.py`,
`app/rules/patterns.py`, `app/main.py`, `app/core/security.py`,
`app/core/pipeline_state.py`, `app/database/*`, `app/api/routes/auth.py`,
`app/api/routes/admin.py`, `app/api/dependencies.py`, and all Pydantic
schemas were reviewed and no bug was found in them relevant to the reported
symptoms. They are copied as-is. If you later find something wrong in one
of these, flag it specifically rather than assuming it was silently
rewritten — it wasn't.

---

## What to verify after deploying

1. Set `OLLAMA_BASE_URL` / `OLLAMA_MODEL` in your `.env` if they differ from
   the defaults (`http://localhost:11434`, `qwen2.5vl:3b`) — these used to
   be hardcoded, so if you were relying on the old hardcoded values with no
   `.env` entry, nothing changes for you.
2. Re-run a batch of the retail/mall receipts that were previously giving
   wrong subtotal/total values — this is the fix most likely to visibly
   change your output.
3. Check that `notes` now appears (possibly `null`, which is correct when
   nothing was found) in newly processed bills, instead of always being
   absent/manual-only.
4. If you have log aggregation, watch for `engine_used=semantic_engine_fallback`
   frequency — if it's high, that means Ollama is failing/unreachable more
   often than expected, which is worth investigating separately from the
   extraction-logic fixes above.
