[English](README.md) | [简体中文](README.zh-CN.md)
# MathLab · Math Visualization Workbench

[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![No Build](https://img.shields.io/badge/build-none-brightgreen.svg)]()
[![No Eval](https://img.shields.io/badge/security-no%20eval%2Fnew%20Function-red.svg)]()

> A single-file, zero-build, **3Blue1Brown-style** math visualization workbench. Get hands-on with math right in your browser.

## 💡 Why MathLab?

Inspired by 3Blue1Brown's videos, I wanted to turn the immersive experience of mathematical animation into a **truly interactive sandbox**. Thanks to its single-file HTML design, you don't need Node.js or Webpack—just double-click to run. With a robust offline fallback strategy (automatically switching to a built-in tweening engine and plain text rendering if the CDN fails), it can even work completely offline.

## ✨ Core Features

- **Zero Build Dependencies**: The core is written in pure vanilla JS + Canvas, with no runtime npm packages. GSAP and KaTeX are optional enhancements with graceful degradation.
- **Plug-and-Play Topics**: Strict adherence to a modular contract. Adding a new math topic only requires adding a single `.js` file—**no modifications to any core code are needed**.
- **Bulletproof Security**: A custom-built expression parser with absolutely no `eval` or `new Function`, preventing injection attacks while gracefully handling syntax and domain errors.
- **Fully Reproducible**: All panel parameters, camera angles, and timeline states can be encoded into a URL. Share your mathematical discoveries with a single click.
- **3Blue1Brown Aesthetic**: Dark background, cyan/yellow/magenta highlights, elegant serif fonts, and smooth GSAP tweening animations.

## 🖼️ Visuals

**3D Cartesian Coordinate System** (Draggable 3D vectors and parallelepipeds):
![3D Cartesian Coordinate System]<img width="1893" height="846" alt="coordinate3d" src="https://github.com/user-attachments/assets/2f4ed3d5-7c9a-40e0-91b3-6de602ab234f" />


**Calculus** (Secant lines approaching tangent lines, Riemann sums converging):
![Calculus]<img width="1905" height="851" alt="calculus" src="https://github.com/user-attachments/assets/d5016a54-2486-49d1-b528-1812f5922faa" />


**Number Theory & Modular Arithmetic** (Prime spirals and Collatz waterfalls):
![Number Theory & Modular Arithmetic]<img width="1902" height="840" alt="numbertheory" src="https://github.com/user-attachments/assets/4a0cbe9b-e602-4ccc-8530-c107d0c5086c" />


## 🚀 Quick Start

1. **Local Development**: Double-click `src/index.html` (Chrome / Edge support loading local classic scripts from `file://`. Firefox users are recommended to use the built artifact).
2. **Single-File Build**: Run `node tools/build.mjs` to generate `dist/mathlab.html`. Double-click to run and distribute it offline to anyone.
3. **Offline Test**: Unplug your network cable and refresh the page. It remains fully functional, with only slightly stiffer animations and text-rendered formulas.

## 🧮 Built-in Topics

| Topic | Description |
| --- | --- |
| **3D Cartesian Coordinate System** | 3D vector addition / dot product projection / cross product / parallelepiped; Cartesian, cylindrical, and spherical coordinate systems; drag vector endpoints (Shift = full degree-of-freedom on the camera plane); double-click the ground to place a free point. |
| **Calculus** | Custom expression parser for f(x)/g(x); secant-to-tangent limit (h→0); central difference differentiation; five Riemann sum methods; log-log convergence plot of error vs. N; auto-scrolling tangent point. |
| **Number Theory & Modular Arithmetic** | Ulam prime spiral, modular multiplication table (multiplicative group/units), Collatz logarithmic waterfall (safe integer overflow protection). |

## ⌨️ Shortcuts

| Key | Action |
| --- | --- |
| `Space` | Play / Pause |
| `←` / `→` | Step back / forward one frame |
| Drag Timeline | Scrub time in real-time |
| Scroll Wheel | Zoom view |
| Drag Empty Space | Rotate view in 3D; set tangent point in 2D |
| `Alt+Drag` | Pan view |
| `Shift+Drag Endpoint` | Full degree-of-freedom drag in 3D |
| `?` | Show help hint |

## 🔗 URL Parameters & Developer Tools

- `?selftest=1`: Run kernel self-tests (including expression parser injection rejection, 4×4 matrix inversion, 3D projection round-trips, numerical calculus, sieve and Collatz boundary tests).
- `?stats=1`: Display real-time frame time (FPS), primitive count, and degradation status indicators.
- `#t=<topic>&s=<compressed_state>`: State sharing. Click "Copy Link" in the panel to generate, and opening the link directly restores your workspace.

## 🧩 Adding a New Topic (Extension Guide)

The essence of this workbench lies in the **decoupling of core and topics**. Adding a new topic **requires zero modifications to any core code**:

1. Create `<name>.js` under `src/topics/`, registering `LAB.topics.<name> = { meta, impl }`.
   - `meta` handles declaring `defaults` (default state), `schema` (UI panel), and `timeline` (timeline keyframes).
   - `impl` implements optional lifecycle methods: `init` / `onParam` / `onMode` / `onToggle` / `onField` / `onPointer` / `onKey` / `applyTime` / `render` / `serialize` / `deserialize` / `selftest`.
2. Add a line `<script src="topics/<name>.js"></script>` in the script section of `src/index.html`.
3. Re-run `node tools/build.mjs`.

## 📂 Project Structure

```text
src/
  index.html            Dev shell (styles, layout, script assembly)
  core/                 Framework (boot/util/tween/vec/expr/state/viewport/render/ui/shortcuts/hud/app)
  topics/               Topic modules (coordinate3d / calculus / numbertheory)
  main.js               Assembly endpoint (sets app.ready)
tools/build.mjs         Concatenates to -> dist/mathlab.html
