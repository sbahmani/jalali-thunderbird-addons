# Iranian Date for Thunderbird

Thunderbird **MailExtension** (140+) that shows **Jalali (Persian / Solar Hijri)** dates alongside the normal UI: a dedicated column in the **table** message list and a line in the **opened message** header.

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

- **Thunderbird** 140.0 or newer (manifest uses `data_collection_permissions`, which current [addons-linter](https://github.com/mozilla/addons-linter) only accepts together with a minimum Gecko that supports that key; older Thunderbird releases can keep using **2.0.x** builds if you still need them.)
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

From the repository root:

```bash
web-ext lint
```

The repo includes **`web-ext-config.mjs`**, which sets **`lint.privileged: true`** for [web-ext](https://extensionworkshop.com/documentation/develop/getting-started-with-web-ext/). That matches how [addons-linter](https://github.com/mozilla/addons-linter) validates extensions that use **`experiment_apis`**: the manifest declares **`mozillaAddons`** (required in that mode) and **`browser_specific_settings.gecko.data_collection_permissions`**. Current linter versions also require **`strict_min_version`** high enough that Gecko supports that key (here **140.0**) and **`gecko_android.strict_min_version`** **142.0** so the Android compatibility check passes. Omit the config only if you pass the same flag yourself: `web-ext lint --privileged`.

### Build the package (`.xpi` / installable ZIP)

Thunderbird installs a **ZIP** of the extension tree; the usual convention is to name that file **`.xpi`**, but **`.zip` and `.xpi` are the same format** — you can install either from **Install Add-on From File…**.

From the repository root:

```bash
web-ext build
```

By default, web-ext writes:

- **Directory:** `web-ext-artifacts/` (next to `manifest.json`)
- **File name:** a slug derived from the project plus the manifest **version**, e.g. `iranian_date_for_thunderbird-2.1.0.zip`

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
| `web-ext-config.mjs` | web-ext defaults (`lint.privileged`) so `web-ext lint` matches experiment add-ons |
| `manifest.json` | WebExtension manifest (MV2), Gecko id, min TB version |
| `background.js` | Registers the experiment on install/startup, reads options |
| `options/` | Options UI (`options.html`, `options.js`) |
| `api/schema.json` | Experiment API schema |
| `api/parent.js` | Parent-process implementation: column, message header hooks |
| `legacy-xul/` | Old XUL-based extension (historical reference only) |

---

## Contributing

Issues and pull requests are welcome. Please describe Thunderbird version and whether you use **table** or **cards** view when reporting list UI behaviour.

---

## Related

- [Thunderbird WebExtensions](https://webextension-api.thunderbird.net/)  
- [Developing extensions for Thunderbird](https://developer.thunderbird.net/add-ons/about)
