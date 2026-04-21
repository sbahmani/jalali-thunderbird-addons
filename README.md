# Iranian Date for Thunderbird

Thunderbird **MailExtension** (115+) that shows **Jalali (Persian / Solar Hijri)** dates alongside the normal UI: a dedicated column in the **table** message list and a line in the **opened message** header.

**Author:** SjB

---

## Features

- **Thread pane — table view**  
  Adds a custom column (**تاریخ**) with a configurable Jalali date string per message. Sorting uses the real message date.

- **Message reader**  
  When you open a message (3-pane or standalone window), a Jalali line is shown near the header date.

- **Options** (`Add-ons → Iranian Date For Thunderbird → Preferences`)

  | Setting        | Meaning                                      |
  | -------------- | -------------------------------------------- |
  | Month style    | Numeric month vs long month name             |
  | Weekday        | Hidden vs shown in the formatted string      |
  | Digits         | Persian (۰–۹) vs Western (0–9) numerals      |

  Options are stored with `storage.local` and applied without restart where possible.

---

## Requirements

- **Thunderbird** 115.0 or newer  
- **Layout:** Jalali in the thread list is provided via a **custom column** — use **table view** and enable the column from the thread pane column picker. Card view is not modified by this add-on.

---

## Install

### From a built package

1. Build or obtain an `.xpi` (see [Development](#development)).
2. In Thunderbird: **☰ → Add-ons and Themes → gear → Install Add-on From File…**
3. Choose the `.xpi` and confirm.

### Temporary load (testing)

With [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/) and Thunderbird on `PATH`:

```bash
web-ext run -t thunderbird
```

---

## Development

### Prerequisites

- **Node.js** (LTS is fine) so you can run [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/).

Install web-ext globally once, or use `npx` without installing:

```bash
npm install -g web-ext
```

### Lint

From the repository root (expect warnings for privileged experiments):

```bash
web-ext lint
```

### Build the package (`.xpi` / installable ZIP)

Thunderbird installs a **ZIP** of the extension tree; the usual convention is to name that file **`.xpi`**, but **`.zip` and `.xpi` are the same format** — you can install either from **Install Add-on From File…**.

From the repository root:

```bash
web-ext build
```

By default, web-ext writes:

- **Directory:** `web-ext-artifacts/` (next to `manifest.json`)
- **File name:** a slug derived from the project plus the manifest **version**, e.g. `iranian_date_for_thunderbird-2.0.1.zip`

To emit an explicit **`.xpi`** name and overwrite on repeat builds:

```bash
web-ext build --filename iranian-date-for-thunderbird.xpi --overwrite-dest
```

Other useful flags:

| Flag | Purpose |
| ---- | ------- |
| `--artifacts-dir <dir>` | Put the artifact somewhere other than `web-ext-artifacts/` |
| `--source-dir <dir>` | Build from another folder (default is current directory) |

Then install the produced file as in [Install](#install) → *From a built package*.

---

The add-on uses a **privileged experiment** (`experiment_apis.IranianDateColumn`) because the thread pane column API is not available to pure WebExtensions yet. Review `api/schema.json` and `api/parent.js` for the surface exposed to the background script.

---

## Repository layout

| Path | Role |
| ---- | ---- |
| `manifest.json` | WebExtension manifest (MV2), Gecko id, min TB version |
| `background.js` | Registers the experiment on install/startup, reads options |
| `options/` | Options UI (`options.html`, `options.js`) |
| `api/schema.json` | Experiment API schema |
| `api/parent.js` | Parent-process implementation: column, message header hooks |
| `legacy-xul/` | Old XUL-based extension (historical reference only) |

---

## Add-on ID

Gecko application ID: **`iraniandate@pouria.p`** (unchanged for upgrade continuity).  
Displayed author in `manifest.json` is **SjB**.

---

## Contributing

Issues and pull requests are welcome. Please describe Thunderbird version and whether you use **table** or **cards** view when reporting list UI behaviour.

---

## Related

- [Thunderbird WebExtensions](https://webextension-api.thunderbird.net/)  
- [Developing extensions for Thunderbird](https://developer.thunderbird.net/add-ons/about)
