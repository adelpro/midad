# Storage Format: the `.midad` container

> How a design is stored on device and as a file, and why the image travels
> beside the document instead of inside it. This is the behavior contract; when
> code and this document disagree, fix the code.

---

## 1. A design is a package, not a JSON blob

A design is a **document plus, when it has one, a background image**. They are
stored as two things, never as one:

| Part               | Content                                             |
| ------------------ | --------------------------------------------------- |
| `design.json`      | the `MidadProject` document — canvas, objects, name |
| `background.<ext>` | the background image, as raw bytes                  |

The image used to be inlined in the document as a base64 `data:` URI. That cost
~33% of the image in padding and, worse, made every autosave re-stringify a
multi-megabyte string. Splitting them is the whole point of this format.

## 2. Where a design lives

The split is the same on both platforms; only the container differs, because
`localStorage` is string-only.

|          | Native                                          | Web                                                                    |
| -------- | ----------------------------------------------- | ---------------------------------------------------------------------- |
| Store    | a **folder per design**: `midad-projects/<id>/` | a **key per file**: `midad-projects:<id>` and `midad-projects:<id>:bg` |
| Document | `design.json` (UTF-8)                           | the key's JSON string                                                  |
| Image    | `background.<ext>` (raw bytes)                  | a `data:` URI string                                                   |
| Discover | enumerate the store's subdirectories            | `AsyncStorage.getAllKeys()`                                            |

There is **no index file**. The designs are the store's contents, so the index
cannot disagree with what is actually saved.

## 3. The `.midad` container

An exported design is one ZIP:

```
design.json      the document, DEFLATE-compressed
background.jpg   the image, stored (level 0)
```

`design.json` compresses well and the image does not (JPEG/PNG is already
compressed), so the image entry is stored rather than deflated — deflating it
would burn CPU for nothing. The container is built and read with `fflate`, which
is pure JS, so export and import work identically on native and web.

The extension is `PROJECT_FILE_EXT` (`midad`) and the shared MIME is
`application/zip`, which is what makes the file open in an ordinary zip tool.

## 4. `imageUri` is in-memory only

The renderers (live canvas, PNG, SVG) all consume `canvas.background.imageUri`,
a `data:` URI. That field is **rebuilt from the stored bytes on load and stripped
before every write** (`toPersisted`). It never reaches disk.

This is what keeps the three renderers untouched by the format change: as far as
they are concerned the background is still a data URI.

The stored `imageMime` is read from the image's **own bytes**
(`sniffImageMime`), not from the picker. `expo-image-picker` can report a type
that disagrees with the file it hands back — a JPEG labelled `image/tiff` — and
that label ends up in the SVG export's `<image href>`, where a viewer that trusts
it can refuse the image.

## 5. Saving

`saveProject` writes the **document only**. The image is written once, when it is
picked (`writeBackgroundImage`) or imported (`writeBackgroundBytes`), never on
the autosave path. That is the contract that makes autosave cheap.

Consequences the callers must honour:

- **Duplicate** must copy the image bytes to the new id before saving the copy.
- **Import** must write the image before saving the document.
- **Rename** and **autosave** write only the document — correct by construction.

## 6. Versioning: v2 only

`PROJECT_FILE_VERSION` is `2`. There is **no v1 reader and no migration path**:
a legacy `.midad.json`, a corrupt archive, or a document from another version is
refused on import (`bad-file`) and ignored by the gallery. v1 documents, the old
`<id>.midad.json` files and the old `.index.json` are dead weight left on disk.

## 7. Code map

| Concern                                                | File                              |
| ------------------------------------------------------ | --------------------------------- |
| Container pack/unpack, `sniffImageMime`, `toPersisted` | `src/storage/design-file.ts`      |
| Native store (folder per design)                       | `src/storage/projects.native.ts`  |
| Web store (key per file)                               | `src/storage/projects.web.ts`     |
| Platform API the rest of the app calls                 | `src/storage/projects.ts`         |
| Export a `.midad`                                      | `src/storage/project-io.ts`       |
| Import a `.midad`                                      | `src/storage/import-project.ts`   |
| Picker → base64 + MIME                                 | `src/storage/background-image.ts` |
| `PROJECT_FILE_VERSION`, `CanvasBackground`             | `src/storage/project-schema.ts`   |
