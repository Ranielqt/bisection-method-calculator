import { useState, useEffect, useRef } from 'react';
import * as math from 'mathjs';
import { 
  Calculator, 
  BookOpen, 
  Info, 
  CheckCircle, 
  AlertCircle, 
  Sparkles, 
  HelpCircle, 
  TrendingDown, 
  ArrowRight,
  ClipboardList,
  Binary,
  Layers,
  Settings,
  Download
} from 'lucide-react';

interface IterationRow {
  iter: number;
  a: number;
  b: number;
  c: number;
  fa: number;
  fb: number;
  fc: number;
  error: number;
}

interface SolveResult {
  success: boolean;
  root?: number;
  iterations?: number;
  errorEst?: number;
  table?: IterationRow[];
  errorMsg?: string;
  warning?: string;
}

const PRESETS = [
  {
    name: "Polynomial: x³ - x - 2",
    expr: "x^3 - x - 2",
    a: "1.0",
    b: "2.0",
    tol: "0.01",
    maxIter: "50"
  },
  {
    name: "Transcendental: cos(x) - x",
    expr: "cos(x) - x",
    a: "0.0",
    b: "1.0",
    tol: "0.001",
    maxIter: "50"
  },
  {
    name: "Exponential: exp(-x) - x",
    expr: "exp(-x) - x",
    a: "0.0",
    b: "1.0",
    tol: "1e-5",
    maxIter: "100"
  },
  {
    name: "Sinusoidal: sin(x) - 0.5",
    expr: "sin(x) - 0.5",
    a: "0.0",
    b: "2.0",
    tol: "1e-4",
    maxIter: "50"
  }
];

export default function App() {
  // Calculator Form State
  const [exprStr, setExprStr] = useState("x^3 - x - 2");
  const [aInput, setAInput] = useState("1.0");
  const [bInput, setBInput] = useState("2.0");
  const [tolInput, setTolInput] = useState("0.01");
  const [maxIterInput, setMaxIterInput] = useState("50");

  const [activeTab, setActiveTab] = useState<'calculator' | 'theory' | 'examples'>('calculator');
  const [result, setResult] = useState<SolveResult | null>(null);

  // SVG dimensions for real-time visualization
  const svgRef = useRef<SVGSVGElement>(null);

  // Typeset MathJax dynamically whenever active visual changes
  useEffect(() => {
    // @ts-ignore
    if (window.MathJax && window.MathJax.typesetPromise) {
      // @ts-ignore
      window.MathJax.typesetPromise();
    }
  }, [activeTab, result]);

  // Handle preset selection
  const applyPreset = (preset: typeof PRESETS[number]) => {
    setExprStr(preset.expr);
    setAInput(preset.a);
    setBInput(preset.b);
    setTolInput(preset.tol);
    setMaxIterInput(preset.maxIter);
    setResult(null);
  };

  // Safe expression execution inside JavaScript
  const evaluateExpr = (compiledExpr: math.EvalFunction, xVal: number): number => {
    try {
      const scope = { x: xVal, X: xVal };
      const val = compiledExpr.evaluate(scope);
      if (typeof val === 'number') return val;
      if (typeof val === 'object' && val.isComplex) {
        if (Math.abs(val.im) < 1e-12) {
          return val.re;
        }
        throw new Error("Complex evaluation roots are unsupported in real-domain solver.");
      }
      return Number(val);
    } catch (e: any) {
      throw new Error(`Evaluation failure: ${e.message}`);
    }
  };

  // Core Bisection Method Engine
  const runBisection = () => {
    // Basic validations
    const a = parseFloat(aInput);
    const b = parseFloat(bInput);
    const tol = parseFloat(tolInput);
    const maxIter = parseInt(maxIterInput);

    if (isNaN(a) || isNaN(b)) {
      setResult({ success: false, errorMsg: "Invalid interval bounds. Ensure a and b are valid numbers." });
      return;
    }
    if (isNaN(tol) || tol <= 0) {
      setResult({ success: false, errorMsg: "Tolerance must be a strictly positive real number (e.g. 1e-6)." });
      return;
    }
    if (isNaN(maxIter) || maxIter <= 0) {
      setResult({ success: false, errorMsg: "Maximum iterations must be a positive integer." });
      return;
    }

    // Replace Python ** with standard exponent ^
    let sanitizedExpr = exprStr.replace(/\*\*/g, '^');

    try {
      const compiled = math.compile(sanitizedExpr);
      
      const fa = evaluateExpr(compiled, a);
      const fb = evaluateExpr(compiled, b);

      if (Math.abs(fa) < 1e-15) {
        setResult({
          success: true,
          root: a,
          iterations: 0,
          errorEst: 0,
          table: [{ iter: 0, a, b, c: a, fa, fb, fc: fa, error: 0 }],
          warning: `Endpoint a = ${a} is already an exact root.`
        });
        return;
      }
      if (Math.abs(fb) < 1e-15) {
        setResult({
          success: true,
          root: b,
          iterations: 0,
          errorEst: 0,
          table: [{ iter: 0, a, b, c: b, fa, fb, fc: fb, error: 0 }],
          warning: `Endpoint b = ${b} is already an exact root.`
        });
        return;
      }

      if (fa * fb > 0) {
        setResult({
          success: false,
          errorMsg: `Intermediate Value Theorem (IVT) condition violated: f(a) and f(b) must have opposite signs. f(${a}) = ${fa.toFixed(5)}, f(${b}) = ${fb.toFixed(5)}.`
        });
        return;
      }

      let currA = a;
      let currB = b;
      let table: IterationRow[] = [];
      let converged = false;
      let currentIteration = 0;
      let rootVal = 0;
      let finalErr = 0;

      // Ensure lower/upper bound logical ordering for algorithm presentation (or calculate directly)
      if (currA > currB) {
        const temp = currA;
        currA = currB;
        currB = temp;
      }

      for (let i = 1; i <= maxIter; i++) {
        currentIteration = i;
        const midVal = (currA + currB) / 2.0;
        const faVal = evaluateExpr(compiled, currA);
        const fbVal = evaluateExpr(compiled, currB);
        const fcVal = evaluateExpr(compiled, midVal);
        const errorEst = Math.abs(currB - currA) / 2.0;

        table.push({
          iter: i,
          a: currA,
          b: currB,
          c: midVal,
          fa: faVal,
          fb: fbVal,
          fc: fcVal,
          error: errorEst
        });

        rootVal = midVal;
        finalErr = errorEst;

        if (Math.abs(fcVal) < 1e-15 || errorEst < tol) {
          converged = true;
          break;
        }

        // Update bracket according to sign change
        if (faVal * fcVal < 0) {
          currB = midVal;
        } else {
          currA = midVal;
        }
      }

      setResult({
        success: true,
        root: rootVal,
        iterations: currentIteration,
        errorEst: finalErr,
        table,
        warning: converged ? undefined : "Reached limit on iterations before satisfying exact error tolerance."
      });

    } catch (err: any) {
      setResult({
        success: false,
        errorMsg: `Failed to compile or evaluate function: ${err.message}`
      });
    }
  };

  // Automatically run the calculations on start to ensure user sees results immediately
  useEffect(() => {
    runBisection();
  }, []);

  const exportAsText = () => {
    if (!result || !result.success || !result.table) return;

    const formattedA = parseFloat(aInput).toFixed(5);
    const formattedB = parseFloat(bInput).toFixed(5);
    const maxIter = parseInt(maxIterInput, 10);

    const rootVal = result.root !== undefined ? result.root.toFixed(5) : "";
    const iterVal = result.iterations !== undefined ? result.iterations : 0;
    const errVal = result.errorEst !== undefined 
      ? (result.errorEst < 1e-4 && result.errorEst > 0 ? result.errorEst.toExponential(5) : result.errorEst.toFixed(5)) 
      : "";

    let tableContent = "";
    result.table.forEach((row) => {
      const aStr = row.a.toFixed(5).padEnd(8);
      const bStr = row.b.toFixed(5).padEnd(8);
      const cStr = row.c.toFixed(5).padEnd(8);
      const fcStr = row.fc.toFixed(5).padEnd(8);
      const errStr = (row.error < 1e-4 && row.error > 0 ? row.error.toExponential(5) : row.error.toFixed(5)).padEnd(8);
      tableContent += `${row.iter.toString().padEnd(4)} | ${aStr} | ${bStr} | ${cStr} | ${fcStr} | ${errStr}\n`;
    });

    const content = `========================================
BISECTION METHOD RESULTS
========================================

Function: f(x) = ${exprStr}
Interval: [${formattedA}, ${formattedB}]
Tolerance: ${tolInput}
Max Iterations: ${maxIter}

----------------------------------------
RESULTS
----------------------------------------
Root: ${rootVal}
Iterations: ${iterVal}
Error: ${errVal}

----------------------------------------
ITERATION TABLE
----------------------------------------
Iter | a        | b        | c        | f(c)     | Error
${tableContent}
========================================`;

    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "bisection_results.txt";
    link.click();
    URL.revokeObjectURL(link.href);
  };

  // Generate SVG path for plotting the math function
  const renderPlotPath = () => {
    if (!result || !result.success || result.table === undefined || result.table.length === 0) return null;
    const items = result.table;
    const firstRow = items[0];
    const borderA = parseFloat(aInput);
    const borderB = parseFloat(bInput);
    
    // Choose nice mathematical bounds
    const plotA = borderA - Math.abs(borderB - borderA) * 0.2;
    const plotB = borderB + Math.abs(borderB - borderA) * 0.2;
    
    const points: [number, number][] = [];
    const steps = 120;
    
    let sanitizedExpr = exprStr.replace(/\*\*/g, '^');
    let compiled;
    try {
      compiled = math.compile(sanitizedExpr);
    } catch {
      return null;
    }

    // Sample function values
    const sampled: {x: number, y: number}[] = [];
    let minY = Infinity;
    let maxY = -Infinity;

    for (let i = 0; i <= steps; i++) {
      const x = plotA + (plotB - plotA) * (i / steps);
      try {
        const y = evaluateExpr(compiled, x);
        if (!isNaN(y) && isFinite(y)) {
          sampled.push({ x, y });
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      } catch {
        // Skip invalid points
      }
    }

    if (sampled.length === 0) return null;

    // Pad minY and maxY
    const ySpan = maxY - minY || 1;
    minY -= ySpan * 0.1;
    maxY += ySpan * 0.1;

    // Canvas settings
    const width = 500;
    const height = 180;

    const toSvgX = (xVal: number) => {
      return ((xVal - plotA) / (plotB - plotA)) * width;
    };

    const toSvgY = (yVal: number) => {
      // invert Y axis
      return height - ((yVal - minY) / (maxY - minY)) * height;
    };

    // Construct curve path
    const pathD = sampled.map((p, i) => {
      const sx = toSvgX(p.x);
      const sy = toSvgY(p.y);
      return `${i === 0 ? 'M' : 'L'} ${sx} ${sy}`;
    }).join(' ');

    // X axis (f = 0)
    const yZeroSvg = toSvgY(0);
    const xAxisPath = `M 0 ${yZeroSvg} L ${width} ${yZeroSvg}`;

    // Root coordinate point
    const rootVal = result.root ?? 0;
    const rootX = toSvgX(rootVal);
    const rootY = toSvgY(0);

    return (
      <div className="bg-[#FBFBFB] p-4 border border-[#E5E7EB] rounded-lg mt-4 shadow-sm">
        <div className="flex justify-between items-center mb-2">
          <span className="text-[11px] font-bold text-[#9B9A97] uppercase tracking-wider">Dynamic Function Visualization</span>
          <span className="text-xs font-medium text-[#37352F] font-mono">f(x) = {exprStr}</span>
        </div>
        <div className="relative w-full overflow-hidden" style={{ height: '180px' }}>
          <svg className="w-full h-full overflow-visible" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
            {/* Horizontal Grid lines */}
            <line x1="0" y1={toSvgY(maxY)} x2={width} y2={toSvgY(maxY)} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3 3" />
            <line x1="0" y1={toSvgY(minY)} x2={width} y2={toSvgY(minY)} stroke="#E5E7EB" strokeWidth="0.5" strokeDasharray="3 3" />
            
            {/* Zero line (X axis) */}
            {yZeroSvg >= 0 && yZeroSvg <= height && (
              <path d={xAxisPath} stroke="#ACABA9" strokeWidth="1.5" />
            )}

            {/* Boundary 'a' & 'b' vertical markers */}
            {borderA >= plotA && borderA <= plotB && (
              <g>
                <line x1={toSvgX(borderA)} y1="0" x2={toSvgX(borderA)} y2={height} stroke="#EB5757" strokeWidth="1" strokeDasharray="2 2" />
                <text x={toSvgX(borderA) + 4} y="14" fill="#EB5757" className="text-[10px] font-bold font-mono">a</text>
              </g>
            )}
            {borderB >= plotA && borderB <= plotB && (
              <g>
                <line x1={toSvgX(borderB)} y1="0" x2={toSvgX(borderB)} y2={height} stroke="#EB5757" strokeWidth="1" strokeDasharray="2 2" />
                <text x={toSvgX(borderB) - 12} y="14" fill="#EB5757" className="text-[10px] font-bold font-mono">b</text>
              </g>
            )}

            {/* Actual Function curve */}
            <path d={pathD} fill="none" stroke="#2383E2" strokeWidth="2" />

            {/* Root highlight dot */}
            {rootVal >= plotA && rootVal <= plotB && (
              <g>
                <circle cx={rootX} cy={rootY} r="5" fill="#37352F" stroke="#FFFFFF" strokeWidth="1.5" className="animate-pulse" />
                <line x1={rootX} y1={rootY} x2={rootX} y2={height - 12} stroke="#37352F" strokeWidth="0.5" strokeDasharray="1 1" />
                <text x={rootX - 24} y={Math.max(rootY - 10, 16)} fill="#37352F" className="text-[10px] font-bold font-mono bg-white">Root (c*)</text>
              </g>
            )}
          </svg>
        </div>
        <div className="flex justify-between text-[10px] text-gray-400 font-mono mt-1">
          <span>x = {plotA.toFixed(2)}</span>
          <span className="text-gray-500 font-medium">Interval: [{borderA}, {borderB}]</span>
          <span>x = {plotB.toFixed(2)}</span>
        </div>
      </div>
    );
  };

  return (
    <div id="app-root" className="flex h-screen w-full bg-[#FFFFFF] font-sans text-[#37352F] overflow-hidden">
      {/* Sidebar - Notion style */}
      <aside className="w-[260px] bg-[#F7F7F5] border-r border-[#E5E7EB] flex flex-col p-5 justify-between select-none shrink-0 h-full">
        <div className="space-y-6">
          {/* Logo Brand */}
          <div className="flex items-center space-x-2.5 px-1.5 py-1">
            <span className="text-2xl text-slate-800">📐</span>
            <div className="flex flex-col">
              <span className="font-bold text-sm tracking-tight text-[#37352F]">PIT Project</span>
              <span className="text-[10px] text-[#9B9A97] font-medium uppercase tracking-wider">Numerical Methods</span>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="space-y-1.5">
            <div className="text-[10px] font-bold text-[#9B9A97] px-2 mb-2 uppercase tracking-widest">Methods Directory</div>
            
            <button 
              onClick={() => setActiveTab('calculator')}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'calculator' 
                  ? 'bg-[#EBEBE9] text-[#37352F] shadow-sm' 
                  : 'text-[#5A5955] hover:bg-[#EBEBE9]/50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Calculator className="h-3.5 w-3.5" />
                <span>Bisection Calculator</span>
              </div>
              <span className="bg-[#2383E2] w-1.5 h-1.5 rounded-full"></span>
            </button>

            <button 
              onClick={() => setActiveTab('theory')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'theory' 
                  ? 'bg-[#EBEBE9] text-[#37352F] shadow-sm' 
                  : 'text-[#5A5955] hover:bg-[#EBEBE9]/50'
              }`}
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>Mathematical Basis</span>
            </button>

            <button 
              onClick={() => setActiveTab('examples')}
              className={`w-full flex items-center space-x-2 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                activeTab === 'examples' 
                  ? 'bg-[#EBEBE9] text-[#37352F] shadow-sm' 
                  : 'text-[#5A5955] hover:bg-[#EBEBE9]/50'
              }`}
            >
              <ClipboardList className="h-3.5 w-3.5" />
              <span>Worked Examples</span>
            </button>
          </nav>

          {/* Quick presets list when on calculator tab */}
          {activeTab === 'calculator' && (
            <div className="pt-4 border-t border-[#E5E7EB]">
              <div className="text-[10px] font-bold text-[#9B9A97] px-2 mb-2 uppercase tracking-widest">Try a Preset Expr</div>
              <div className="space-y-1">
                {PRESETS.map((preset, index) => (
                  <button
                    key={index}
                    onClick={() => applyPreset(preset)}
                    className="w-full text-left text-[11px] text-[#5A5955] hover:text-[#37352F] px-2 py-1.5 rounded hover:bg-[#EBEBE9]/30 transition-all font-medium truncate block"
                    title={preset.name}
                  >
                    🚀 {preset.name.split(":")[0]}: <span className="font-mono text-gray-500">{preset.expr}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer detailing metadata */}
        <div className="pt-4 border-t border-[#E5E7EB] text-[10px] text-[#9B9A97] space-y-1">
          <p>© 2026 Numerical Methods</p>
        </div>
      </aside>

      {/* Main Panel */}
      <main className="flex-1 flex flex-col h-full bg-white overflow-hidden">
        {/* Dynamic Nav Breadcrumbs and Top bar */}
        <header className="px-8 pt-6 pb-4 border-b border-[#F1F1EF] flex justify-between items-center shrink-0">
          <div>
            <div className="flex items-center space-x-1.5 text-xs text-[#9B9A97] mb-1 font-medium">
              <span>PIT Project</span>
              <span>/</span>
              <span>Numerical Methods</span>
              <span>/</span>
              <span className="text-[#37352F] font-semibold">
                {activeTab === 'calculator' && "Interactive Calculator"}
                {activeTab === 'theory' && "Mathematical Discussion"}
                {activeTab === 'examples' && "Two Worked Examples"}
              </span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-[#37352F]">
              Bisection Root Finder
            </h1>
          </div>
        </header>

        {/* Tab Selection Area */}
        <div className="flex-1 overflow-y-auto px-8 py-6">
          {/* CALCULATOR INTERFACE */}
          {activeTab === 'calculator' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
              {/* Form Input parameters - Left inside grid */}
              <div className="lg:col-span-5 bg-[#FBFBFB] border border-[#E5E7EB] rounded-xl p-6 shadow-sm space-y-5">
                <div className="flex items-center space-x-2 pb-2 border-b border-[#F1F1EF]">
                  <Settings className="h-4 w-4 text-[#37352F]" />
                  <h2 className="text-sm font-bold uppercase tracking-wider text-[#37352F]">Solver Settings</h2>
                </div>

                <div className="form-group">
                  <label className="text-[11px] font-bold text-[#9B9A97] uppercase tracking-wider block mb-1">
                    Function Expression f(x)
                  </label>
                  <input 
                    type="text" 
                    value={exprStr}
                    onChange={(e) => setExprStr(e.target.value)}
                    placeholder="e.g. x^3 - x - 2"
                    className="w-full px-3 py-2 font-mono text-sm border border-[#E5E7EB] rounded-md bg-white text-[#37352F] outline-none focus:ring-2 focus:ring-[#37352F]/10 focus:border-[#37352F]"
                  />
                  <p className="form-control-hint mt-1 text-[10px] text-[#9B9A97]">
                    Standard math parsing supported: <code>x^3</code>, <code>cos(x)</code>, <code>exp(-x)</code>, <code>sqrt(x)</code>.
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-[11px] font-bold text-[#9B9A97] uppercase tracking-wider block mb-1">
                      Left Endpoint (a)
                    </label>
                    <input 
                      type="text" 
                      value={aInput}
                      onChange={(e) => setAInput(e.target.value)}
                      placeholder="1.0"
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-md bg-white text-[#37352F] outline-none focus:border-[#37352F] font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-[11px] font-bold text-[#9B9A97] uppercase tracking-wider block mb-1">
                      Right Endpoint (b)
                    </label>
                    <input 
                      type="text" 
                      value={bInput}
                      onChange={(e) => setBInput(e.target.value)}
                      placeholder="2.0"
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-md bg-white text-[#37352F] outline-none focus:border-[#37352F] font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="form-group">
                    <label className="text-[11px] font-bold text-[#9B9A97] uppercase tracking-wider block mb-1">
                      Tolerance (ε)
                    </label>
                    <input 
                      type="text" 
                      value={tolInput}
                      onChange={(e) => setTolInput(e.target.value)}
                      placeholder="0.001"
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-md bg-white text-[#37352F] outline-none focus:border-[#37352F] font-mono"
                    />
                  </div>

                  <div className="form-group">
                    <label className="text-[11px] font-bold text-[#9B9A97] uppercase tracking-wider block mb-1">
                      Max Iterations
                    </label>
                    <input 
                      type="text" 
                      value={maxIterInput}
                      onChange={(e) => setMaxIterInput(e.target.value)}
                      placeholder="50"
                      className="w-full px-3 py-2 text-sm border border-[#E5E7EB] rounded-md bg-white text-[#37352F] outline-none focus:border-[#37352F] font-mono"
                    />
                  </div>
                </div>

                <button 
                  onClick={runBisection}
                  className="w-full bg-[#37352F] text-white py-2.5 rounded-lg text-xs font-bold hover:bg-[#2F2D28] transition-colors shadow-sm flex items-center justify-center space-x-2"
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  <span>Calculate Root Approximation</span>
                </button>

                {/* Left col dynamic line plot */}
                {result?.success && renderPlotPath()}
              </div>

              {/* Solver Outcome - Right inside grid */}
              <div className="lg:col-span-7 space-y-6">
                {/* Error Banner if any */}
                {result && !result.success && (
                  <div className="notion-callout notion-callout-warning flex items-start space-x-3 bg-red-50 text-red-800 border-l-4 border-red-500 rounded-lg p-4">
                    <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
                    <div>
                      <h4 className="font-bold text-sm">Calculation Aborted</h4>
                      <p className="text-xs mt-1 leading-relaxed text-red-700 font-mono">{result.errorMsg}</p>
                    </div>
                  </div>
                )}

                {/* Success Banner & metrics card */}
                {result && result.success && (
                  <div className="space-y-6">
                    {result.warning && (
                      <div className="flex items-center space-x-2.5 bg-yellow-50 text-yellow-850 p-3.5 rounded-lg border-l-4 border-yellow-500 text-xs font-medium">
                        <AlertCircle className="h-4 w-4 shrink-0 text-yellow-600" />
                        <span>{result.warning}</span>
                      </div>
                    )}

                    <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
                      <div className="flex items-center justify-between mb-4 pb-2 border-b border-[#F1F1EF]">
                        <div className="flex items-center space-x-2">
                          <CheckCircle className="h-4.5 w-4.5 text-[#2B7A3E]" />
                          <h3 className="text-sm font-bold text-[#37352F]">CONVERGENCE SUMMARY</h3>
                        </div>
                        <span className="badge-success bg-[#EAF6EC] text-[#2B7A3E] px-2.5 py-1 rounded text-[11px] font-bold uppercase">
                          Converged of ε
                        </span>
                      </div>

                      <div className="grid grid-cols-3 gap-4">
                        <div className="bg-[#F7F7F5] border border-[#E5E7EB] rounded-lg p-3.5 text-center">
                          <div className="text-[10px] text-[#9B9A97] font-bold uppercase tracking-wider mb-1">Approximate Root (c*)</div>
                          <div className="text-base font-bold font-mono text-[#37352F]">{result.root?.toFixed(5)}</div>
                          <div className="text-[9px] text-[#9B9A97] mt-0.5 font-sans">Precision boundary target</div>
                        </div>

                        <div className="bg-[#F7F7F5] border border-[#E5E7EB] rounded-lg p-3.5 text-center">
                          <div className="text-[10px] text-[#9B9A97] font-bold uppercase tracking-wider mb-1">Iterations Elapsed</div>
                          <div className="text-base font-bold font-mono text-[#37352F]">{result.iterations}</div>
                          <div className="text-[9px] text-[#9B9A97] mt-0.5 font-sans">Linear cycles run</div>
                        </div>

                        <div className="bg-[#F7F7F5] border border-[#E5E7EB] rounded-lg p-3.5 text-center">
                          <div className="text-[10px] text-[#9B9A97] font-bold uppercase tracking-wider mb-1">Error Estimate</div>
                          <div className="text-base font-bold font-mono text-[#2B7A3E]">
                            {result.errorEst !== undefined ? (result.errorEst < 1e-4 && result.errorEst > 0 ? result.errorEst.toExponential(5) : result.errorEst.toFixed(5)) : ''}
                          </div>
                          <div className="text-[9px] text-[#9B9A97] mt-0.5 font-sans">Standard precision halving</div>
                        </div>
                      </div>
                    </div>

                    {/* Step by step calculations Table */}
                    {result.table && result.table.length > 0 && (
                      <div className="bg-[#FFFFFF] border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm">
                        <div className="p-4 bg-[#F7F7F5] border-b border-[#E5E7EB] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                          <h3 className="text-xs font-bold text-[#37352F] uppercase tracking-wider">Complete Iterative Solver Output</h3>
                          <div className="flex flex-wrap items-center gap-3">
                            <span className="text-[10px] text-[#9B9A97] font-mono">Tolerance: {tolInput}</span>
                            <button
                              id="export-results-txt-btn"
                              onClick={exportAsText}
                              className="bg-[#37352F] text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-md hover:bg-[#2F2D28] transition-all flex items-center space-x-1.5 hover:cursor-pointer shadow-xs border border-transparent"
                            >
                              <Download className="w-3.5 h-3.5" />
                              <span>Export Results as Text</span>
                            </button>
                          </div>
                        </div>
                        <div className="overflow-x-auto max-h-[300px]">
                          <table className="w-full text-xs text-left border-collapse">
                            <thead className="sticky top-0 bg-[#F7F7F5] border-b border-[#E5E7EB] z-10 text-[10px] uppercase font-bold text-[#9B9A97] tracking-wider">
                              <tr>
                                <th className="p-3 text-center border-r border-[#E5E7EB] w-12">#</th>
                                <th className="p-3">a (Left)</th>
                                <th className="p-3">b (Right)</th>
                                <th className="p-3">c (Midpoint)</th>
                                <th className="p-3">f(c)</th>
                                <th className="p-3 text-right">Error Estimate</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#F1F1EF] font-mono text-[#37352F]">
                              {result.table.map((row) => (
                                <tr key={row.iter} className="hover:bg-[#F7F7F5]/50 transition-colors">
                                  <td className="p-3 text-center bg-[#F7F7F5]/30 border-r border-[#E5E7EB] font-bold text-[#73726E] text-[11px]">{row.iter}</td>
                                  <td className="p-3">{row.a.toFixed(5)}</td>
                                  <td className="p-3">{row.b.toFixed(5)}</td>
                                  <td className="p-3 font-semibold text-[#2383E2]">{row.c.toFixed(5)}</td>
                                  <td className="p-3">{row.fc.toFixed(5)}</td>
                                  <td className="p-3 text-right font-medium text-slate-500">
                                    {row.error < 1e-4 && row.error > 0 ? row.error.toExponential(5) : row.error.toFixed(5)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* MATHEMATICAL BASIS DISCUSSION */}
          {activeTab === 'theory' && (
            <div className="max-w-3xl space-y-6">
              <section className="bg-white border border-[#E5E7EB] rounded-xl p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-bold mb-3 flex items-center space-x-2">
                    <span className="text-lg">📖</span>
                    <span>Intermediate Value Theorem (IVT)</span>
                  </h2>
                  <p className="text-sm leading-relaxed text-[#5A5955]">
                    The **Bisection Method** is a fundamental numerical rooting approach that is mathematically established upon the **Intermediate Value Theorem (IVT)**. This theorem states:
                  </p>
                  <div className="notion-callout bg-[#F1F1EF] border-l-4 border-[#37352F] p-4 my-4 rounded">
                    <p className="text-sm italic font-medium leading-relaxed">
                      "If a function $f(x)$ is continuous on a closed interval $[a, b]$, and $u$ is any real number strictly between $f(a)$ and $f(b)$, then there exists at least one value $c$ in the open interval $(a, b)$ such that $f(c) = u$."
                    </p>
                  </div>
                  <p className="text-sm leading-relaxed text-[#5A5955]">
                    If we choose $u = 0$, and notice that the signs of $f(a)$ and $f(b)$ are opposite (meaning $f(a) \cdot f(b) &lt; 0$), the theorem guarantees that there exists at least one real number $c \in (a, b)$ forming a root such that:
                  </p>
                  <p className="text-base text-center my-3 font-mono font-bold">$f(c) = 0$</p>
                </div>

                <div className="pt-4 border-t border-[#F1F1EF]">
                  <h2 className="text-xl font-bold mb-3 flex items-center space-x-2">
                    <span className="text-lg">⚙️</span>
                    <span>Step-by-Step Algorithm</span>
                  </h2>
                  <ol className="math-list text-sm text-[#5A5955] space-y-3">
                    <li>
                      <strong>1. Initial Bracket:</strong> Identify interval $[a, b]$ where the signs of function evaluations are opposite: {"$f(a) \\cdot f(b) < 0$"}.
                    </li>
                    <li>
                      <strong>2. Evaluate Midpoint:</strong> Compute the direct midpoint: <br />
                      <div className="text-center my-2 font-mono bg-[#F7F7F5] py-2 rounded border border-[#E5E7EB] inline-block px-4">{"$c = \\frac{a + b}{2}$"}</div>
                    </li>
                    <li>
                      <strong>3. Check Stop Conditions:</strong> If {"$|b - a| / 2 < \\text{Tolerance}$"} or {"$f(c) \\approx 0$"}, current $c$ is the root.
                    </li>
                    <li>
                      <strong>4. Interval Shift:</strong> Evaluate $f(c)$:
                      <ul className="list-disc pl-5 mt-2 space-y-1">
                        <li>If {"$f(a) \\cdot f(c) < 0$"}, set $b = c$ (the root lies in left half).</li>
                        <li>Otherwise, set $a = c$ (the root lies in right half).</li>
                      </ul>
                    </li>
                    <li>
                      <strong>5. Loop:</strong> repeat from Step 2 until the criteria is achieved.
                    </li>
                  </ol>
                </div>

                <div className="pt-4 border-t border-[#F1F1EF]">
                  <h2 className="text-xl font-bold mb-3 flex items-center space-x-2">
                    <span className="text-lg">📉</span>
                    <span>Convergence Characteristics</span>
                  </h2>
                  <p className="text-sm leading-relaxed text-[#5A5955]">
                    The Bisection Method features **linear convergence**. The absolute boundary error halves on every single iteration step. For any iteration $k \geq 1$, the upper error estimate $E_k$ is represented as:
                  </p>
                  <div className="text-center my-3 font-mono bg-[#F7F7F5] py-2.5 rounded border border-[#E5E7EB] block mx-auto w-48">
                    {"$E_k = \\frac{b_0 - a_0}{2^k} \\le \\epsilon$"}
                  </div>
                  <p className="text-sm leading-relaxed text-[#5A5955]">
                    This allows us to pre-calculate the exact maximum number of iterations $N$ required to achieve a target tolerance $\epsilon$ using:
                  </p>
                  <div className="text-center my-3 font-mono bg-[#F7F7F5] py-2.5 rounded border border-[#E5E7EB] block mx-auto w-56">
                    {"$N = \\lceil \\frac{\\ln(b - a) - \\ln(\\epsilon)}{\\ln(2)} \\rceil$"}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-6 border-t border-[#F1F1EF]">
                  <div className="p-4 bg-[#EAF6EC] border-l-4 border-emerald-600 rounded-r-lg">
                    <h3 className="font-bold text-sm text-emerald-800 mb-1 flex items-center">
                      <span className="mr-1.5">✓</span> Advantages
                    </h3>
                    <ul className="text-xs text-slate-700 space-y-1 list-disc pl-4 leading-relaxed">
                      <li>Always guaranteed to converge if the initial $f(a) \cdot f(b) &lt; 0$.</li>
                      <li>Highly outer-bracket robust; is not affected by complex inflection points like Newton's method.</li>
                      <li>Extremely simplistic logic to compute.</li>
                    </ul>
                  </div>

                  <div className="p-4 bg-red-50 border-l-4 border-red-500 rounded-r-lg">
                    <h3 className="font-bold text-sm text-red-900 mb-1 flex items-center">
                      <span className="mr-1.5">✗</span> Disadvantages
                    </h3>
                    <ul className="text-xs text-red-950 space-y-1 list-disc pl-4 leading-relaxed">
                      <li>Slow linear rate of convergence.</li>
                      <li>Fails if continuous sign values do not cross 0 (such as double roots like $f(x) = (x-1)^2$).</li>
                      <li>Requires initial manual windowing bounds.</li>
                    </ul>
                  </div>
                </div>
              </section>
            </div>
          )}

          {/* TWO WORKED EXAMPLES */}
          {activeTab === 'examples' && (
            <div className="max-w-4xl space-y-8">
              <section className="bg-white border border-[#E5E7EB] rounded-xl p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-2xl font-bold mb-1 text-[#37352F]">Two Worked Mathematical Computations</h2>
                  <p className="text-sm text-[#9B9A97]">Explore exact step-by-step mathematical calculations demonstrating convergence.</p>
                </div>

                {/* Example 1 */}
                <div className="example-card border-l-4 border-[#37352F] pl-5 space-y-4 pt-2">
                  <div className="flex items-center space-x-2">
                    <Binary className="h-4.5 w-4.5 text-[#2383E2]" />
                    <h3 className="text-base font-bold text-[#37352F]">Example #1: Cubic Polynomial ($x^3 - x - 2$)</h3>
                  </div>
                  <p className="text-sm text-[#5A5955] leading-relaxed">
                    {"We trace the root analysis of $f(x) = x^3 - x - 2$ on the closed interval $[1, 2]$ using target tolerance $\\epsilon = 0.1$."}
                  </p>
                  
                  <div className="bg-[#F7F7F5] p-4 rounded-lg text-xs leading-relaxed max-w-2xl font-sans space-y-2">
                    <p>• <strong>Verification of sign change:</strong></p>
                    <p className="pl-4 font-mono">f(a) = f(1) = 1³ - 1 - 2 = -2.0  (Negative)</p>
                    <p className="pl-4 font-mono">f(b) = f(2) = 2³ - 2 - 2 = +4.0  (Positive)</p>
                    <p className="pl-4">Notice $f(a) \cdot f(b) &lt; 0$. A real root is guaranteed in $(1, 2)$ bounds.</p>
                  </div>

                  <div className="table-wrapper mt-4 overflow-x-auto">
                    <table className="notion-table w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#F7F7F5]">
                          <th className="p-2.5 font-semibold text-[#37352F] text-center">Iter (k)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">Left (a)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">Right (b)</th>
                          <th className="p-2.5 font-semibold text-[#37352F] text-[#2383E2]">Midpoint (c)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">f(c)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">Interval Sign Check</th>
                          <th className="p-2.5 font-semibold text-[#37352F] text-right">Error Est.</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        <tr className="border-b border-[#E5E7EB]/60 hover:bg-[#F7F7F5]/30">
                          <td className="p-2.5 text-center font-bold text-[#73726E]">1</td>
                          <td className="p-2.5">1.00000</td>
                          <td className="p-2.5">2.00000</td>
                          <td className="p-2.5 font-semibold text-[#2383E2]">1.50000</td>
                          <td className="p-2.5">-0.12500</td>
                          <td className="p-2.5 text-[#5A5955]">f(1.50000) · f(2.00000) &lt; 0 &nbsp;→&nbsp; New [1.50000, 2.00000]</td>
                          <td className="p-2.5 text-right">0.50000</td>
                        </tr>
                        <tr className="border-b border-[#E5E7EB]/60 hover:bg-[#F7F7F5]/30">
                          <td className="p-2.5 text-center font-bold text-[#73726E]">2</td>
                          <td className="p-2.5">1.50000</td>
                          <td className="p-2.5">2.00000</td>
                          <td className="p-2.5 font-semibold text-[#2383E2]">1.75000</td>
                          <td className="p-2.5">1.60938</td>
                          <td className="p-2.5 text-[#5A5955]">f(1.50000) · f(1.75000) &lt; 0 &nbsp;→&nbsp; New [1.50000, 1.75000]</td>
                          <td className="p-2.5 text-right">0.25000</td>
                        </tr>
                        <tr className="border-b border-[#E5E7EB]/60 hover:bg-[#F7F7F5]/30">
                          <td className="p-2.5 text-center font-bold text-[#73726E]">3</td>
                          <td className="p-2.5">1.50000</td>
                          <td className="p-2.5">1.75000</td>
                          <td className="p-2.5 font-semibold text-[#2383E2]">1.62500</td>
                          <td className="p-2.5">0.66602</td>
                          <td className="p-2.5 text-[#5A5955]">f(1.50000) · f(1.62500) &lt; 0 &nbsp;→&nbsp; New [1.50000, 1.62500]</td>
                          <td className="p-2.5 text-right">0.12500</td>
                        </tr>
                        <tr className="bg-emerald-50/70 text-emerald-950 font-semibold border-b border-[#E5E7EB]/60">
                          <td className="p-2.5 text-center font-bold">4</td>
                          <td className="p-2.5">1.50000</td>
                          <td className="p-2.5">1.62500</td>
                          <td className="p-2.5 text-[#2383E2]">1.56250</td>
                          <td className="p-2.5">0.25293</td>
                          <td className="p-2.5 text-emerald-800">Error (0.06250) &lt; Tolerance (0.1) reached!</td>
                          <td className="p-2.5 text-right text-emerald-800">0.06250</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-[#5A5955] leading-relaxed bg-[#F7F7F5] p-3.5 rounded-lg border border-[#E5E7EB]">
                    <strong>Final Conclusion:</strong> After 4 iterations, the root is bracketed in $[1.5, 1.625]$ with midpoint $c = 1.5625$ and error $0.0625 &lt; 0.1$. The true root is approximately $1.52138$, which would require more iterations for higher precision.
                  </div>
                </div>

                {/* Example 2 */}
                <div className="example-card border-l-4 border-[#2383E2] pl-5 space-y-4 pt-4 border-t border-[#F1F1EF]">
                  <div className="flex items-center space-x-2">
                    <Layers className="h-4.5 w-4.5 text-[#2B7A3E]" />
                    <h3 className="text-base font-bold text-[#37352F]">Example #2: Trigonometric Transcendental {"($\\cos(x) - x$)"}</h3>
                  </div>
                  <p className="text-sm text-[#5A5955] leading-relaxed">
                    {"We trace the transcendental function $f(x) = \\cos(x) - x$ on the classical interval $[0, 1]$ with target tolerance $\\epsilon = 0.1$."}
                  </p>

                  <div className="bg-[#F7F7F5] p-4 rounded-lg text-xs leading-relaxed max-w-2xl font-sans space-y-2">
                    <p>• <strong>Verification of sign change:</strong></p>
                    <p className="pl-4 font-mono">f(0) = cos(0) - 0 = 1.00000  (Positive)</p>
                    <p className="pl-4 font-mono">f(1) = cos(1) - 1 = 0.54030 - 1 = -0.45970  (Negative)</p>
                    <p className="pl-4">Notice $f(a) \cdot f(b) &lt; 0$. There is guaranteed convergence inside $[0, 1]$.</p>
                  </div>

                  <div className="table-wrapper mt-4 overflow-x-auto">
                    <table className="notion-table w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-[#E5E7EB] bg-[#F7F7F5]">
                          <th className="p-2.5 font-semibold text-[#37352F] text-center">Iter (k)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">Left (a)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">Right (b)</th>
                          <th className="p-2.5 font-semibold text-[#37352F] text-[#2383E2]">Midpoint (c)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">f(c)</th>
                          <th className="p-2.5 font-semibold text-[#37352F]">Interval Sign Check</th>
                          <th className="p-2.5 font-semibold text-[#37352F] text-right">Error Est.</th>
                        </tr>
                      </thead>
                      <tbody className="font-mono">
                        <tr className="border-b border-[#E5E7EB]/60 hover:bg-[#F7F7F5]/30">
                          <td className="p-2.5 text-center font-bold text-[#73726E]">1</td>
                          <td className="p-2.5">0.00000</td>
                          <td className="p-2.5">1.00000</td>
                          <td className="p-2.5 font-semibold text-[#2383E2]">0.50000</td>
                          <td className="p-2.5">0.37758</td>
                          <td className="p-2.5 text-[#5A5955]">f(0.50000) · f(1.00000) &lt; 0 &nbsp;→&nbsp; New [0.50000, 1.00000]</td>
                          <td className="p-2.5 text-right">0.50000</td>
                        </tr>
                        <tr className="border-b border-[#E5E7EB]/60 hover:bg-[#F7F7F5]/30">
                          <td className="p-2.5 text-center font-bold text-[#73726E]">2</td>
                          <td className="p-2.5">0.50000</td>
                          <td className="p-2.5">1.00000</td>
                          <td className="p-2.5 font-semibold text-[#2383E2]">0.75000</td>
                          <td className="p-2.5">-0.01831</td>
                          <td className="p-2.5 text-[#5A5955]">f(0.50000) · f(0.75000) &lt; 0 &nbsp;→&nbsp; New [0.50000, 0.75000]</td>
                          <td className="p-2.5 text-right">0.25000</td>
                        </tr>
                        <tr className="border-b border-[#E5E7EB]/60 hover:bg-[#F7F7F5]/30">
                          <td className="p-2.5 text-center font-bold text-[#73726E]">3</td>
                          <td className="p-2.5">0.50000</td>
                          <td className="p-2.5">0.75000</td>
                          <td className="p-2.5 font-semibold text-[#2383E2]">0.62500</td>
                          <td className="p-2.5">0.18596</td>
                          <td className="p-2.5 text-[#5A5955]">f(0.62500) · f(0.75000) &lt; 0 &nbsp;→&nbsp; New [0.62500, 0.75000]</td>
                          <td className="p-2.5 text-right">0.12500</td>
                        </tr>
                        <tr className="bg-emerald-50/70 text-emerald-950 font-semibold border-b border-[#E5E7EB]/60">
                          <td className="p-2.5 text-center font-bold">4</td>
                          <td className="p-2.5">0.62500</td>
                          <td className="p-2.5">0.75000</td>
                          <td className="p-2.5 text-[#2383E2]">0.68750</td>
                          <td className="p-2.5">0.08552</td>
                          <td className="p-2.5 text-emerald-800">Error (0.06250) &lt; Tolerance (0.1) reached!</td>
                          <td className="p-2.5 text-right text-emerald-800">0.06250</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <div className="text-xs text-[#5A5955] leading-relaxed bg-[#F7F7F5] p-3.5 rounded-lg border border-[#E5E7EB]">
                    <strong>Final Conclusion:</strong> After 4 iterations, the root is bracketed in $[0.625, 0.75]$ with midpoint $c = 0.6875$ and error $0.0625 &lt; 0.1$. The true root is approximately $0.73909$, which would require more iterations for higher precision.
                  </div>
                </div>
              </section>
            </div>
          )}
        </div>

        {/* Global Footer */}
        <footer className="px-8 py-4 border-t border-[#F1F1EF] flex justify-between items-center text-[11px] text-[#9B9A97] shrink-0 font-sans bg-[#FBFBFB]">
          <span>PIT Project – Numerical Methods Online Calculator</span>
        </footer>
      </main>
    </div>
  );
}
