# Gerbtrace

An open-source PCB NPI and manufacturing data preparation platform by **[Newmatik GmbH](https://www.newmatik.com)**.

Gerbtrace takes your design files and turns them into production-ready manufacturing data. Import Gerber files, manage your Bill of Materials, configure Pick and Place, set up panelization and paste, estimate pricing, compare revisions, and collaborate with your team — all from one tool.

Runs in the browser or as a native desktop app. No uploads, no server — everything stays local.

**Web App:** [gerbtrace.com](https://gerbtrace.com)
**Desktop Downloads:** [GitHub Releases](https://github.com/newmatik/gerbtrace/releases)
**Documentation:** [gerbtrace.com/docs](https://gerbtrace.com/docs)

## Features

- **Gerber Viewer** — render and inspect PCB layers with realistic 3D-style preview, measurement, and canvas tools
- **Revision Comparison** — side-by-side, overlay, pixel diff, and text diff between two Gerber packages
- **Bill of Materials** — import, enrich, and price BOMs with multi-manufacturer support and Elexess API integration
- **Pick and Place** — visualize component placement, manage packages, align origins, and export machine-ready PnP files
- **Panelization** — visual panel editor with grid layout, frame, fiducials, tooling holes, tabs, and routing channels
- **Paste Configuration** — stencil and jet print modes with dot pattern preview
- **PCB Pricing** — fabrication and assembly cost estimation across quantity tiers
- **Collaboration** — team workspaces, role-based access, project approval workflows, and real-time presence

## Quick Start

### Web

Visit [gerbtrace.com](https://gerbtrace.com) — no installation required.

### Desktop

Download the latest installer from [GitHub Releases](https://github.com/newmatik/gerbtrace/releases):

- **macOS** — `.dmg`
- **Windows** — `.msi` / `.exe`

The desktop app checks for updates automatically on launch.

## Development

```bash
# Install dependencies
npm install

# Start web development server
npm run dev

# Start Tauri desktop development
npm run tauri:dev
```

See the [Development Setup](https://gerbtrace.com/docs/development/setup) guide for full details.

## Acknowledgments

- **[tracespace](https://github.com/tracespace/tracespace)** (MIT) — Gerber parser architecture inspired by tracespace's lexer-parser-plotter pipeline
- **[Ucamco](https://www.ucamco.com/en/gerber)** — Official Gerber Layer Format Specification
- **[Arduino](https://www.arduino.cc)** — Sample project uses Arduino UNO open-source hardware design

## License

MIT — [Newmatik GmbH](https://www.newmatik.com)
