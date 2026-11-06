# Docs writing style

The pages in `src/content/*.mdx` use **ASD-STE100 Simplified Technical English (STE)**. STE makes
the text easy to understand, also for readers whose first language is not English. Use these rules
when you add or change a page.

## Words

- Use only the approved meaning of a word. For example, use **start**, not "launch". Use **show**,
  not "display". Use **make sure**, not "ensure". Use **get**, not "obtain".
- Use one word for one thing. For example, always use **overlay**, **region** and **settings window**.
- Do not use contractions ("don't", "it's"). Write **do not** and **it is**.
- Do not use abbreviations like "e.g." or "i.e.". Write **for example**.
- Do not use phrasal verbs like "set up", "turn on" or "pick up". Write **set the switch to on** or
  **select**.
- Do not use "-ing" words as verbs or nouns ("after installing"). Write **after you install**.
- Technical names and technical verbs are permitted. Technical names are the names on the screen
  (**Calibrate**, **Grab frame**, **Start with Windows**) and product names (OwlTrack, MapleStory,
  Tesseract). The technical verbs in these docs are: **calibrate**, **click**, **right-click**,
  **drag**, **type**, **download**, **install**, **uninstall**, **delete**, **capture**, **zoom**.

## Sentences

- Procedural sentences (instructions): 20 words maximum.
- Descriptive sentences: 25 words maximum.
- Write one instruction in each sentence. Use the imperative: **Click Pick.**
- Use the active voice. Write **OwlTrack reads the EXP**, not "the EXP is read".
- Use "the", "a" and "this" before nouns where possible.
- Give one topic in each paragraph. Use 6 sentences maximum in each paragraph.

## Procedures and notices

- Write procedures as numbered lists, one action for each step.
- If a step has a condition, put the condition first: **If the dot is not green, click Pick.**
- Use `<Note>` for information that helps the reader.
- Use `<Caution>` before an action that can cause a loss of data or settings, for example when the
  reader deletes `%APPDATA%\OwlTrack`.
- Use tables for settings, controls and values.

## Screenshots

Add a screenshot when the reader must find a control or compare the screen with the text. Use
`<Figure src="screenshots/<name>.png" alt="…" width={…}>caption</Figure>`, with the width of the
real window (`1000` for the settings window, `560` for the welcome screen, `372` for the overlay).

The screenshots come from the web app's simulated demo, which uses the real desktop components.
To make them again after a UI change:

```bash
npm run dev:web                   # in a different terminal
npm run screenshots -w @repo/docs # writes public/screenshots/*.png
```

To add a screenshot, add an entry to `SHOTS` in `scripts/screenshots.mjs`. To show a different
state, add a `?shot=` mode in `apps/web/src/Shot.tsx`.
