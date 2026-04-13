# Ask Elijah — Brand & Code Rules

## Email Template Standard

Every transactional email must follow this exact structure. No exceptions.

### Layout (in order)
1. **Logo** — `<img src="https://elijahbryant.pro/logo-email.png" width="52" height="8">` centered, `margin-bottom:48px`
2. **Two-tone headline** — white line (`color:#ffffff !important`) + gray line (`color:#555555`), both `font-size:40px; font-weight:800; letter-spacing:-0.02em; line-height:1.1`. White: `margin-bottom:4px`. Gray: `margin-bottom:48px`
3. **Body content** — `font-size:15px; color:#ffffff !important; line-height:1.7`
4. **Text link CTA** (if needed) — `font-size:13px; color:#555555; text-decoration:none` — never a button
5. **Signature** — `Elijah` in white (`font-size:14px`), then slogan in dark gray (`color:#444444; font-size:11px; text-transform:uppercase; letter-spacing:0.08em`): `Your body is trained. Your mind isn't.`

### Rules
- Background: `#000000` everywhere — on `<body>`, all `<table>`, all `<td>` via `bgcolor` + inline style + `!important`
- All text: `color:#ffffff !important` on every element (email clients override CSS)
- Left borders on blockquotes: always `border-left:3px solid #ffffff` — never gray
- No credential line (`• Elijah Bryant · NBA · EuroLeague Champion •`) — removed, don't add back
- No white button CTAs — gray text links only
- No em dashes (`—`) anywhere in copy
- No AI-sounding phrases: "that information changes everything", "two minutes, three questions", etc.
- Voice: first-person Elijah, direct, short sentences, no filler
- Dark mode: always include `<meta name="color-scheme" content="dark">` and `<meta name="supported-color-schemes" content="dark">`
- Full `<!DOCTYPE html>` wrapper on every email

### Slogan
`Your body is trained. Your mind isn't.` — appears at the bottom of every email, always.
