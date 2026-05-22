import os
import re
import math
import numpy as np
from flask import Flask, render_template, request, jsonify

app = Flask(__name__)

# Secure evaluation dictionary
ALLOWED_NAMES = {
    'sin': np.sin,
    'cos': np.cos,
    'tan': np.tan,
    'exp': np.exp,
    'log': np.log,
    'log10': np.log10,
    'sqrt': np.sqrt,
    'pi': np.pi,
    'e': np.e,
    'abs': np.abs,
    'sinh': np.sinh,
    'cosh': np.cosh,
    'tanh': np.tanh,
    'asin': np.arcsin,
    'acos': np.arccos,
    'atan': np.arctan,
}

def parse_and_evaluate(expr_str, x_val):
    # Sanitize input: replace common notations
    cleaned = expr_str.replace('^', '**')
    # Use regular expressions to handle implicit multiplications: e.g., "3x" -> "3*x", "3.5x" -> "3.5*x"
    cleaned = re.sub(r'(\d+(?:\.\d+)?)\s*([a-zA-Z_])', r'\1*\2', cleaned)
    # Also handle combinations like "x(" to "x*("
    cleaned = re.sub(r'([xX])\s*\(', r'\1*(', cleaned)
    
    # Restrict names in compiled code to only approved ones
    try:
        code = compile(cleaned, '<string>', 'eval')
    except Exception as e:
        raise ValueError(f"Syntax Error: Invalid mathematical expression format. ({str(e)})")
    
    for name in code.co_names:
        if name.lower() == 'x':
            continue
        if name not in ALLOWED_NAMES:
            raise NameError(f"Deactivated name detected: '{name}'. Only Standard numeric constants/functions are verified.")

    # Create local namespace per evaluation
    eval_globals = {"__builtins__": None}
    eval_locals = {**ALLOWED_NAMES, 'x': x_val, 'X': x_val}
    
    try:
        result = eval(code, eval_globals, eval_locals)
        # Convert numpy floats/complex to native float if needed
        if isinstance(result, (complex, np.complexfloating)):
            if abs(result.imag) < 1e-12:
                result = result.real
            else:
                raise ValueError("Encountered complex numbers. Root solving is supported for real values only.")
        return float(result)
    except Exception as e:
        raise ValueError(f"Error evaluating expression at x = {x_val}: {str(e)}")

def bisection_solver(expr, a, b, tol, max_iter):
    try:
        fa = parse_and_evaluate(expr, a)
        fb = parse_and_evaluate(expr, b)
    except Exception as e:
        return {"success": False, "error": str(e)}

    # Check exact roots at boundaries
    if abs(fa) < 1e-15:
        return {
            "success": True,
            "root": a,
            "iterations": 0,
            "error_est": 0.0,
            "table": [{"iter": 0, "a": a, "b": b, "c": a, "fa": fa, "fb": fb, "fc": 0.0, "error": 0.0}],
            "message": f"Boundary endpoint 'a' is already a root: f({a:.6f}) = {fa}"
        }
    if abs(fb) < 1e-15:
        return {
            "success": True,
            "root": b,
            "iterations": 0,
            "error_est": 0.0,
            "table": [{"iter": 0, "a": a, "b": b, "c": b, "fa": fa, "fb": fb, "fc": 0.0, "error": 0.0}],
            "message": f"Boundary endpoint 'b' is already a root: f({b:.6f}) = {fb}"
        }

    if fa * fb > 0:
        return {
            "success": False,
            "error": f"Intermediate Value Theorem (IVT) violation: No sign change detected over initial interval [{a}, {b}]. f(a) = {fa:.6f}, f(b) = {fb:.6f}. They must have opposite signs."
        }

    table = []
    # Ensure a < b
    curr_a = float(a)
    curr_b = float(b)
    
    for i in range(1, max_iter + 1):
        try:
            fa_val = parse_and_evaluate(expr, curr_a)
            fb_val = parse_and_evaluate(expr, curr_b)
        except Exception as e:
            return {"success": False, "error": f"Evaluation crashed during iteration {i}: {str(e)}"}

        mid = (curr_a + curr_b) / 2.0
        try:
            fc_val = parse_and_evaluate(expr, mid)
        except Exception as e:
            return {"success": False, "error": f"Evaluation crashed on midpoint in iteration {i}: {str(e)}"}

        error_estimate = abs(curr_b - curr_a) / 2.0
        
        table.append({
            "iter": i,
            "a": curr_a,
            "b": curr_b,
            "c": mid,
            "fa": fa_val,
            "fb": fb_val,
            "fc": fc_val,
            "error": error_estimate
        })

        if abs(fc_val) < 1e-15 or error_estimate < tol:
            return {
                "success": True,
                "root": mid,
                "iterations": i,
                "error_est": error_estimate,
                "table": table
            }

        # Update interval
        if fa_val * fc_val < 0:
            curr_b = mid
        else:
            curr_a = mid

    # Completed max_iter
    return {
        "success": True,
        "root": (curr_a + curr_b) / 2.0,
        "iterations": max_iter,
        "error_est": abs(curr_b - curr_a) / 2.0,
        "table": table,
        "warning": "Maximum iterations reached before reaching the requested tolerance of absolute precision."
    }

@app.route('/', methods=['GET', 'POST'])
def index():
    # Keep input presets to make UX flawless
    input_function = "x**3 - x - 2"
    input_a = "1.0"
    input_b = "2.0"
    input_tol = "0.01"
    input_max_iter = "100"
    
    result = None
    error_msg = None
    
    if request.method == 'POST':
        input_function = request.form.get('function', '').strip()
        input_a = request.form.get('endpoint_a', '').strip()
        input_b = request.form.get('endpoint_b', '').strip()
        input_tol = request.form.get('tolerance', '').strip()
        input_max_iter = request.form.get('max_iterations', '').strip()
        
        try:
            a = float(input_a)
            b = float(input_b)
            tol = float(input_tol)
            max_iter = int(input_max_iter)
            
            if tol <= 0:
                raise ValueError("Tolerance must be a strictly positive real number.")
            if max_iter <= 0:
                raise ValueError("Maximum iterations must be a strictly positive integer.")
            if a >= b:
                # Let's support automatically re-ordering if useful, or output a clear error
                a, b = min(a, b), max(a, b)
                input_a = str(a)
                input_b = str(b)
                
            res = bisection_solver(input_function, a, b, tol, max_iter)
            if res.get('success'):
                result = res
            else:
                error_msg = res.get('error')
                
        except ValueError as ve:
            error_msg = f"Invalid input value: {str(ve)}"
        except Exception as e:
            error_msg = f"An unexpected solver error occurred: {str(e)}"
            
    return render_template(
        'index.html',
        function=input_function,
        endpoint_a=input_a,
        endpoint_b=input_b,
        tolerance=input_tol,
        max_iterations=input_max_iter,
        result=result,
        error_msg=error_msg
    )

if __name__ == '__main__':
    # Standard development server port mapping
    app.run(host='0.0.0.0', port=5000, debug=True)
