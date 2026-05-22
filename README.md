# 📐 Bisection Method Calculator

A clean, interactive web application for solving equations using the **Bisection Method** – a fundamental root-finding algorithm in numerical analysis.

![Bisection Method](https://img.shields.io/badge/Numerical-Methods-blue)
![React](https://img.shields.io/badge/React-19.0.1-61DAFB)
![TypeScript](https://img.shields.io/badge/TypeScript-5.8.2-3178C6)
![Vite](https://img.shields.io/badge/Vite-6.2.3-646CFF)
![License](https://img.shields.io/badge/License-MIT-green)

---

## 🎯 Project Overview

This project was developed as part of the **PIT Project – Numerical Methods Online Calculator** assignment. It provides:

- ✅ **Mathematical discussion** of the Bisection Method with LaTeX rendering
- ✅ **Two complete worked examples** with step-by-step solutions
- ✅ **Interactive calculator** with real-time root finding
- ✅ **Iteration table** showing convergence progress
- ✅ **CSV export** for iteration data
- ✅ **Convergence plot** visualizing error reduction

---

## 🧮 The Bisection Method

The **Bisection Method** is a root-finding algorithm that repeatedly bisects an interval and selects the subinterval containing the root. It is based on the **Intermediate Value Theorem**:

> If \( f(a) \cdot f(b) < 0 \), then there exists \( c \in [a, b] \) such that \( f(c) = 0 \)

### Algorithm Steps:
1. Choose interval \([a, b]\) where \( f(a) \cdot f(b) < 0 \)
2. Compute midpoint \( c = \frac{a + b}{2} \)
3. Evaluate \( f(c) \)
4. If \( |f(c)| < \epsilon \) or interval is sufficiently small, stop
5. If \( f(a) \cdot f(c) < 0 \), set \( b = c \); else set \( a = c \)
6. Repeat steps 2-5

### Convergence:
- **Linear convergence** with error bound: \( |x_n - r| \leq \frac{b-a}{2^n} \)
- **Guaranteed convergence** (unlike Newton's method)
- **Slower convergence** than other methods (trade-off for reliability)

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| **Interactive Calculator** | Input any mathematical function and parameters |
| **5 Decimal Display** | Clean, readable output format |
| **Iteration Table** | Full history of a, b, c, f(c), and error |
| **Convergence Plot** | Visualize error reduction over iterations |
| **CSV Export** | Download iteration data for analysis |
| **Preset Examples** | One-click loading of common functions |
| **Error Handling** | Validates inputs and displays helpful messages |
| **Responsive Design** | Works on desktop, tablet, and mobile |

---

## 🚀 Live Demo

Deployed on **Vercel**:
> [https://bisection-method-calculator.vercel.app](https://bisection-method-calculator.vercel.app)

---

## 🛠️ Technology Stack

| Technology | Purpose |
|------------|---------|
| **React 19** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool and dev server |
| **MathJax** | LaTeX rendering |
| **Chart.js** | Convergence plotting |
| **Math.js** | Safe function parsing |
| **CSS3** | Styling (Notion-inspired) |

---

## 📦 Installation & Local Development

### Prerequisites
- Node.js 18+ or 20+
- npm or yarn

### Steps

```bash
# 1. Clone the repository
git clone https://github.com/Ranielqt/bisection-method-calculator.git
cd bisection-method-calculator

# 2. Install dependencies
npm install

# 3. Start development server
npm run dev

# 4. Open browser to http://localhost:3000
