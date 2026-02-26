---
title: Gerbtrace Documentation
description: Documentation for Gerbtrace, a source-available PCB NPI and manufacturing data preparation platform.
---

# Gerbtrace Documentation

Gerbtrace is a source-available PCB NPI and manufacturing data preparation platform by [Newmatik GmbH](https://www.newmatik.com) ([BUSL-1.1](/docs/licensing)). It runs as a web app at [gerbtrace.com](https://gerbtrace.com) and as a native desktop app for macOS and Windows.

Gerbtrace takes your design output and turns it into production-ready manufacturing data. Import Gerber and drill files, manage your Bill of Materials with pricing, configure Pick and Place with a full package library, set up panelization and paste, compare design revisions, estimate fabrication and assembly costs, and collaborate with your team – all from a single tool.

## Getting Started

New to Gerbtrace? Start here.

- [Getting Started](/docs/getting-started) – Installation, creating your first project, and importing files
- [Licensing](/docs/licensing) – Business Source License 1.1 (BUSL-1.1), permitted use, and automatic MIT relicensing

## Viewer

The core project tabs for working with your PCB data.

- [Files](/docs/viewer/files) – Import and classify Gerber, drill, PnP, BOM, and document files
- [PCB](/docs/viewer/pcb) – Board parameters, layer management, canvas tools, and rendering modes
- [Panel](/docs/viewer/panel) – Grid layout, frame, fiducials, tooling holes, tabs, and support bars
- [Paste](/docs/viewer/paste) – Stencil and jet print paste configuration
- [SMD](/docs/viewer/smd) – Surface-mount component placement, visualization, and package matching
- [THT](/docs/viewer/tht) – Through-hole component placement with assembly type assignment
- [BOM](/docs/viewer/bom) – Bill of Materials with manufacturer tracking and supplier pricing
- [Docs](/docs/viewer/docs) – PDF document viewer for schematics and drawings
- [Conversation](/docs/viewer/conversation) – Threaded project discussions with mentions, references, and attachments
- [Summary](/docs/viewer/summary) – Assembly overview with component counts, categories, and warnings
- [Pricing](/docs/viewer/pricing) – Fabrication and assembly cost estimation with quantity tiers

## Tools

Supporting workflows and utilities.

- [Exports](/docs/tools/exports) – Export Image, Export Panel Image, Download Gerber, Export PnP, Export DXF, and Export JPSys
- [Compare](/docs/tools/compare) – Side-by-side, overlay, pixel diff, and text diff comparison
- [Package Manager](/docs/tools/package-manager) – Browse and manage SMD and THT package libraries with team and space scoping
- [Draw Tool](/docs/tools/draw-tool) – Draw shapes, place fiducials, and add drill holes on Gerber and Excellon layers

## Collaboration

Team management, communication, and account settings.

- [Team Settings](/docs/collaboration/team-settings) – Team name, defaults, integrations (Elexess API, Spark AI), and panel defaults
- [Team Members](/docs/collaboration/team-members) – Member management, roles (admin, editor, viewer, guest), and invitations
- [User Profile](/docs/collaboration/user-profile) – Account management, avatar, and team switching
- [Spaces](/docs/collaboration/spaces) – Organize projects and packages into workgroups for customers or product lines
- [Notifications](/docs/collaboration/notifications) – Inbox for mentions, approvals, and project status updates

## App

Platform and interface settings.

- [Desktop App](/docs/app/desktop) – Native macOS and Windows app with auto-updates
- [Light & Dark Mode](/docs/app/light-dark-mode) – Switch between interface themes
- [Performance Monitor](/docs/app/performance-monitor) – Real-time rendering metrics
- [Report a Bug](/docs/app/report-a-bug) – Submit feedback directly from within Gerbtrace

## Guides

Step-by-step workflows for common tasks.

- [Importing Files](/docs/guides/importing-files) – File import, auto-detection, and field mapping
- [Supported Formats](/docs/guides/supported-formats) – Gerber, Excellon, BOM, PnP, and document formats
- [Package Library](/docs/guides/package-library) – Built-in and team packages for SMD and THT components
- [Panel Checks](/docs/guides/panel-checks) – Validation checklist before production handover

## Reference

Technical specifications and format documentation.

- [BOM File Format](/docs/reference/bom-format) – Column mapping, delimiter detection, and examples
- [Package Definitions](/docs/reference/package-definitions) – TPSys package types, JSON schema, and coordinate system
- [Package Naming](/docs/reference/package-naming) – Canonical naming rules for package libraries
- [TPSys Format](/docs/reference/tpsys-format) – Deep reference for the Mycronic TPSys pck.pck database
- [Jet Printing](/docs/reference/jet-printing) – MY600 jet printer technical overview

## Development

For contributors and developers.

- [Development Setup](/docs/development/setup) – Prerequisites, dev server, desktop builds
- [Architecture](/docs/development/architecture) – Rendering pipeline, data flow, and system components
- [CAD Libraries](/docs/development/cad-libraries) – External library ingestion and parser pipeline
- [Release Process](/docs/development/release-process) – Version bumps, tagging, CI/CD workflows
- [Error Monitoring](/docs/development/error-monitoring) – Sentry integration for web and desktop
- [Contributing](/docs/development/contributing) – Coding conventions, design system, and how to help
