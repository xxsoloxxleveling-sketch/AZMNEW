# AZM Study Notes

This is the separate web reader for `notes.azmaio.com`. It is deliberately separate from the main AZM portal so official operational documents (roll-number slips, results, and staff files) retain their existing PDF/print functions.

## Local preview

Run `npm run dev:notes`, then open `http://localhost:3001`.

## Production build

Run `npm run build:notes`. The completed static site is placed in `dist-notes`.

The deployment workflow builds both sites and publishes the Notes files into `/notes` on the `deploy` branch. In Hostinger, set the document root for `notes.azmaio.com` to the `notes` directory of that published site.

## Included Session 5 material

The reader currently contains the four supplied question banks: Classes 6 & 7 (57 pages), Classes 8 & 9 (125 pages), Class 10 (62 pages), and 1st & 2nd Year (92 pages). The original PDFs are rendered as individual web pages under `public/library/`; they are not published as downloadable PDF files.

Collection titles and messages are configured in `src/main.tsx`.

## Reader safeguards

The reader deliberately provides no PDF-export or download buttons, blocks its own print shortcut/right-click menu, uses a print-only notice, and places an AZM watermark over each lesson. These are deterrents for ordinary browser use, not a guarantee against screenshots, developer tools, or external cameras.
