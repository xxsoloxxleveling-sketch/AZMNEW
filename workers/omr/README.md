# Isolated OMR worker

Development only. This process recognizes marks but never assigns a student, writes marks or publishes results. All output is untrusted until authenticated backend reconciliation and review. Do not run the current scaffold as a production service.

## Reproduce

Create a Python virtual environment, install requirements.txt, then run:

```
python -m unittest discover -s workers/omr -p "test_*.py" -v
python workers/omr/engine.py private-scan.png --annotation private-annotation.png
```

Annotation files contain protected scans. Keep them in private temporary storage; never commit them or serve them publicly. JSON stdout can contain decoded identity and must go directly to protected orchestration, never general logs.

Calibration takes a private, blank, rendered reference image and extracts only numeric geometry:

```
python workers/omr/calibrate.py private-reference.png workers/omr/template-v2.json
```

The profile is tied to Template 2.0 Session V 2026. New printable layout variants require separately reviewed calibration. Thresholds are provisional synthetic thresholds. A recognition result is not an official grade. Missing originals, low-quality captures, unknown identities, provisional sheets and uncertain marks must not automatically create official results.

## Current boundaries

PNG/JPEG only at this stage. PDF signature/page-count validation and isolated rendering are required before exposing a PDF-upload API. Process timeout, durable queue, OS process/memory limits, private storage and rate limiting belong in the upcoming orchestration milestone. CPU parallelism is limited to one OpenCV thread. ARM64 Linux deployment and performance must be measured independently of Windows development.

The initial annular-interior measurement excludes most preprinted central letters and outer outlines. Synthetic tests compare empty printed bubbles, dark fills, gray fills, multiple fills and distortions. It has not yet established physical-camera accuracy, erasure/correction-fluid reliability or glare robustness. Keep production scoring disabled until those are validated.

## Recorded scanner-core validation (2026-11-06)

- OpenCV 4.12.0.88 and NumPy 2.2.6 installed in an isolated environment from checksum-verified official PyPI wheels.
- 23 recognition/classification tests passed, covering rotations, modest perspective, resolution scaling, noise, all answer options, blanks, multiple/gray marks, paper versions, QR/session/provisional rejection, missing markers and blur.
- Supplied digital blank PDF at 2800-pixel page height: 100/100 blank answers, no ambiguous/multiple classifications, QR decoded, registration 0.96. No candidate identifiers were recorded in the report.
- Synthetic benchmark: 10 sheets, 1,000 answers, 1,000 correct classifications; exact answer sequences on all 10; no rejected or review-required clean synthetic sheets. Median 1.291 seconds, maximum 1.357 seconds on this Windows development host. These are small synthetic-suite measurements, not physical-camera accuracy or Oracle ARM64 throughput.
- PDF ingestion limits, glare/erasure validation, durable processing and official server grading remain upcoming work. Scanner-core tests do not establish the complete product acceptance scenarios.
