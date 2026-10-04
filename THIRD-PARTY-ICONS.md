# Third-party icons

midad can import a pictogram from an open icon set and place it on the canvas as a
vector element. The icon's geometry is resolved and stored **in the design file**
when it is imported, so a design that names an icon needs no network to open and
the icon travels with the `.midad`.

Icons are sourced through the [Iconify](https://iconify.design/) public API
(`https://api.iconify.design`), which aggregates open icon sets. Iconify does not
claim rights over the icons it serves; each set is licensed by its own authors,
and that licence is what governs the import. Only sets carrying a permissive
licence whose icons are **monotone, filled paths** (a single ink, no baked
palette, no stroke outline the renderers would fill) are offered.

| Set prefix         | Name                  | Licence    | Licence URL                                                         |
| ------------------ | --------------------- | ---------- | ------------------------------------------------------------------- |
| `material-symbols` | Material Symbols      | Apache-2.0 | https://github.com/google/material-design-icons/blob/master/LICENSE |
| `mdi`              | Material Design Icons | Apache-2.0 | https://github.com/Templarian/MaterialDesign/blob/master/LICENSE    |
| `ph`               | Phosphor              | MIT        | https://github.com/phosphor-icons/core/blob/main/LICENSE            |
| `bi`               | Bootstrap Icons       | MIT        | https://github.com/twbs/icons/blob/main/LICENSE.md                  |

## Adding a set

1. Read the set's entry from `GET https://api.iconify.design/collections?prefixes=<prefix>`
   and confirm `palette` is `false`.
2. Fetch a few icons and confirm their bodies are filled paths (`<path d="…">`
   with no `stroke` outline) — a stroke set cannot be rendered faithfully yet.
3. Add it to `ICON_SET_ALLOWLIST` in `src/theme/icon-sets.ts`.
4. Add a row here.
5. Run `node scripts/check-icons.mjs`. It fails if a prefix is offered without a
   record here, or if a recorded licence is incomplete.

The full licence text of each set is published at the URL in the table and is not
duplicated here; the app imports icons, it does not redistribute the sets.

The bundled **font** faces carry their own record, in `assets/fonts/LICENSES.md`.
