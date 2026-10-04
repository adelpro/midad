# Storage Format: the `.midad` container

> How a design is stored on device and as a file, and why the image travels
> beside the document instead of inside it. This is the behavior contract; when
> code and this document disagree, fix the code.

---

## 1. A design is a package, not a JSON blob

A design is a **document plus the images it references**. They are stored as
separate things, never as one:

| Part                      | Content                                             |
| ------------------------- | --------------------------------------------------- |
| `design.json`             | the `MidadProject` document — canvas, objects, name |
| `background.<ext>`        | the canvas background image, as raw bytes           |
| `assets/<objectId>.<ext>` | a **placed image** object's bytes (0.6.0)           |

The background keeps its own entry name rather than becoming an asset, because it
is not an object: it has no transform, no z-order and no id, and a v2 document
already names it `background.<ext>`. Keeping that name is what lets a
pre-0.6.0 design open without touching it.

An image used to be inlined in the document as a base64 `data:` URI. That cost
~33% of the image in padding and, worse, made every autosave re-stringify a
multi-megabyte string. Splitting them is the whole point of this format — and it
is why a **placed** image is a file here too, rather than the convenient inline
alternative.

## 2. Where a design lives

The split is the same on both platforms; only the container differs, because
`localStorage` is string-only.

|          | Native                                          | Web                                                                      |
| -------- | ----------------------------------------------- | ------------------------------------------------------------------------ |
| Store    | a **folder per design**: `midad-projects/<id>/` | a **key per file**: `midad-projects:<id>`, `:<id>:bg`, `:<id>:img:<obj>` |
| Document | `design.json` (UTF-8)                           | the key's JSON string                                                    |
| Image    | `background.<ext>` (raw bytes)                  | a `data:` URI string                                                     |
| Assets   | `img_<objectId>.<ext>` (raw bytes)              | a `data:` URI string                                                     |
| Discover | enumerate the store's subdirectories            | `AsyncStorage.getAllKeys()`                                              |

There is **no index file**. The designs are the store's contents, so the index
cannot disagree with what is actually saved.

## 3. The `.midad` container

An exported design is one ZIP:

```
design.json            the document, DEFLATE-compressed
background.jpg         the background image, stored (level 0)
assets/i_1712_ab12.jpg a placed image, stored (level 0)
```

`design.json` compresses well and images do not (JPEG/PNG is already compressed),
so image entries are stored rather than deflated — deflating them would burn CPU
for nothing. The container is built and read with `fflate`, which is pure JS, so
export and import work identically on native and web.

The extension is `PROJECT_FILE_EXT` (`midad`) and the shared MIME is
`application/zip`, which is what makes the file open in an ordinary zip tool.

## 4. `imageUri` is in-memory only

The renderers (live canvas, PNG, SVG) all consume a `data:` URI — the background's
`canvas.background.imageUri`, and each placed image's own object `imageUri`. Both
are **rebuilt from the stored bytes on load and stripped before every write**
(`toPersisted`). Neither ever reaches disk.

A leak is not cosmetic: `design.json` is written on every autosave, so a surviving
`imageUri` would re-serialise every placed image's full base64 payload each time
the document is saved. `toPersisted` strips the background's **and** every
`type === 'image'` object's.

This is what keeps the three renderers untouched by the format: as far as they are
concerned an image is still a data URI.

The stored `imageMime` is read from the image's **own bytes** (`sniffImageMime`),
not from the picker. `expo-image-picker` can report a type that disagrees with the
file it hands back — a JPEG labelled `image/tiff` — and that label ends up in the
SVG export's `<image href>`, where a viewer that trusts it can refuse the image.

## 5. Saving

`saveProject` writes the **document only**. Image bytes are written once, when they
are picked (`writeBackgroundImage`, `writeAssetBytes`) or imported
(`writeBackgroundBytes`), never on the autosave path. That is the contract that
makes autosave cheap.

**The save also sweeps orphans.** A deleted object, or a replaced image on an
existing object, leaves bytes behind; `saveProject` removes every stored asset
whose object is no longer in the document. Sweeping on save rather than hooking
each mutation keeps the rule in one place and makes **undo safe by construction**:
an undone delete is an object that is present again, so its bytes are never swept.
There is a window — delete, save, undo — in which the bytes are already gone; the
object then renders empty, which is the same degradation an exported design with a
missing entry gets (§4), and it is not silent data loss of anything else.

Consequences the callers must honour:

- **Duplicate** must copy every stored image to the new id before saving the copy.
- **Import** must write every image before saving the document.
- **Rename** and **autosave** write only the document — correct by construction.

## 6. Versioning: v3, with a reader for v2

`PROJECT_FILE_VERSION` is `3`. Placed images are what moved it: a v2 document has
exactly one image slot (the background) and no object asset entries.

**A v2 document is still read.** `normalizeProjectVersion` accepts `version 2 or
3` and returns the document at version 3; it is called by all three load paths —
`unpackDesign` (import), `projects.native.ts` (device) and `projects.web.ts`
(device) — so the rule is stated once. A v2 document cannot contain an image or an
icon object, so nothing else needs rewriting. This is the whole reader: without
it, bumping the version would have hidden every design a user already had, because
the gallery treats a refused document as absent.

Anything else is refused: a v1 archive, a future version, a document with no
canvas background, a corrupt archive. A legacy `.midad.json`, the old `.index.json`
and v1 documents are dead weight left on disk.

## 7. Code map

| Concern                                                | File                              |
| ------------------------------------------------------ | --------------------------------- |
| Container pack/unpack, `sniffImageMime`, `toPersisted` | `src/storage/design-file.ts`      |
| Native store (folder per design)                       | `src/storage/projects.native.ts`  |
| Web store (key per file)                               | `src/storage/projects.web.ts`     |
| Platform API the rest of the app calls                 | `src/storage/projects.ts`         |
| Export a `.midad`                                      | `src/storage/project-io.ts`       |
| Import a `.midad`                                      | `src/storage/import-project.ts`   |
| Picker → base64 + MIME + pixel size                    | `src/storage/placed-image.ts`     |
| Background picker (delegates to the above)             | `src/storage/background-image.ts` |
| Shared base64 → bytes                                  | `src/storage/base64.ts`           |
| Version reader, `PROJECT_FILE_VERSION`, object kinds   | `src/storage/project-schema.ts`   |
| Imported-icon catalogue and fetch                      | `src/storage/icon-search.ts`      |
