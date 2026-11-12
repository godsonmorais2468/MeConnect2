# ME-CONNECT

Stand-alone UI prototype. It needs no backend and no login: every request is answered in the browser from sample data (`src/lib/demoApi.ts`), and changes you make are kept in this browser until the end of the day.

## Run it

```bash
npm install
npm run dev
```

On the sign-in screen, **Login Now** opens the app as a chapter member on the head table, with nothing typed in. **Region Admin** and **Super Admin** under it open those areas.

All names, numbers and payments are made up.

## Runs on any device

`src/lib/perf.ts` picks a visual tier for the device and sets `data-perf` on the page: `high` (everything), `mid` (lighter blur, fewer moving parts) or `low` (flat and still). It starts from a hardware guess, then watches the frame rate and steps down if the device cannot keep up, remembering that next time. To try a tier by hand, add `?perf=low`, `?perf=mid` or `?perf=high` to the address.

## Where the design lives

- `src/styles/tokens.css`: colours, type, radii, shadows ("Pine & Paper").
- `src/styles/components.css`: styles for each screen's pieces.
- `src/styles/design.css`: app frame, primitives, sign-in and home. Loaded last, so it wins.
- `src/components/Shell.tsx`: side rail on desktop, bottom tab bar on phones and tablets.
- `src/components/AuthArt.tsx`: pine panel beside the sign-in form.
- `src/pages/member/Home.tsx`: home layout.
- `src/lib/demoApi.ts`: sample data and the answers to every request.
