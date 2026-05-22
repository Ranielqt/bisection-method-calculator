/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

type TokenType = 'NUMBER' | 'VARIABLE' | 'OPERATOR' | 'FUNCTION' | 'LPAREN' | 'RPAREN';

interface Token {
  type: TokenType;
  value: string;
}

// Allowed functions-names
const FUNCTIONS = new Set(['sin', 'cos', 'tan', 'exp', 'log', 'log10', 'sqrt', 'abs', 'sinh', 'cosh', 'tanh', 'asin', 'acos', 'atan']);

// Allowed constants
const CONSTANTS = {
  pi: Math.PI,
  e: Math.E,
};

const OPERATOR_PRECEDENCE: Record<string, number> = {
  '+': 1,
  '-': 1,
  '*': 2,
  '/': 2,
  'U+': 3, // unary plus
  'U-': 3, // unary minus
  '^': 4,
};

const OPERATOR_ASSOCIATIVITY: Record<string, 'L' | 'R'> = {
  '+': 'L',
  '-': 'L',
  '*': 'L',
  '/': 'L',
  'U+': 'R',
  'U-': 'R',
  '^': 'R',
};

export function tokenize(expr: string): Token[] {
  // Pre-process expression string to handle implicit multiplications and clean exponent notations
  let sanitized = expr.replace(/\s+/g, ''); // strip spaces
  sanitized = sanitized.replace(/\*\*/g, '^'); // replace ** with ^ (standard power)
  
  // Insert implicit multiplications using regexes
  // E.g., 2x -> 2*x
  sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*([a-zA-Z_])/g, '$1*$2');
  // E.g., x(x+1) -> x*(x+1)
  sanitized = sanitized.replace(/([xX])\s*\(/g, '$1*(');
  // E.g., 2(x+1) -> 2*(x+1)
  sanitized = sanitized.replace(/(\d+(?:\.\d+)?)\s*\(/g, '$1*(');
  // E.g., )( -> )*(
  sanitized = sanitized.replace(/\)\s*\(/g, ')*(');
  // E.g., )x -> )*x
  sanitized = sanitized.replace(/\)\s*([xX])/g, ')*$1');

  const tokens: Token[] = [];
  let i = 0;
  const n = sanitized.length;

  while (i < n) {
    const char = sanitized[i];

    // Numbers (integers or decimals)
    if (/\d/.test(char) || char === '.') {
      let numStr = '';
      let hasDecimal = false;
      while (i < n && (/\d/.test(sanitized[i]) || sanitized[i] === '.')) {
        if (sanitized[i] === '.') {
          if (hasDecimal) {
            throw new Error(`Invalid double decimals in digit float at character index ${i}`);
          }
          hasDecimal = true;
        }
        numStr += sanitized[i];
        i++;
      }
      tokens.push({ type: 'NUMBER', value: numStr });
      continue;
    }

    // Parentheses
    if (char === '(') {
      tokens.push({ type: 'LPAREN', value: '(' });
      i++;
      continue;
    }
    if (char === ')') {
      tokens.push({ type: 'RPAREN', value: ')' });
      i++;
      continue;
    }

    // Mathematical Operators
    if (['+', '-', '*', '/', '^'].includes(char)) {
      tokens.push({ type: 'OPERATOR', value: char });
      i++;
      continue;
    }

    // Identifiers (Variables, Constants, or Functions)
    if (/[a-zA-Z]/.test(char)) {
      let idStr = '';
      while (i < n && /[a-zA-Z0-9]/.test(sanitized[i])) {
        idStr += sanitized[i];
        i++;
      }
      const lowerId = idStr.toLowerCase();
      if (lowerId === 'x') {
        tokens.push({ type: 'VARIABLE', value: 'x' });
      } else if (FUNCTIONS.has(lowerId)) {
        tokens.push({ type: 'FUNCTION', value: lowerId });
      } else if (lowerId in CONSTANTS) {
        tokens.push({ type: 'NUMBER', value: CONSTANTS[lowerId as keyof typeof CONSTANTS].toString() });
      } else {
        throw new Error(`Unrecognized symbol or constant name: "${idStr}" at index ${i - idStr.length}`);
      }
      continue;
    }

    // Unrecognized Characters
    throw new Error(`Invalid symbol candidate detected in equations: "${char}" at index ${i}`);
  }

  return tokens;
}

export function parseToPostfix(tokens: Token[]): Token[] {
  const outputQueue: Token[] = [];
  const operatorStack: Token[] = [];

  // Tracks if current spot expects a term. Helps identify unary operators.
  // After operations like '+', '-', '*', '/', '^', or '(', or at the beginning, we expect a term.
  let expectTerm = true;

  for (let j = 0; j < tokens.length; j++) {
    const token = tokens[j];

    if (token.type === 'NUMBER' || token.type === 'VARIABLE') {
      outputQueue.push(token);
      expectTerm = false;
    } else if (token.type === 'FUNCTION') {
      operatorStack.push(token);
      expectTerm = true; // wait for arguments block e.g., cos(...)
    } else if (token.type === 'LPAREN') {
      operatorStack.push(token);
      expectTerm = true;
    } else if (token.type === 'RPAREN') {
      let top = operatorStack[operatorStack.length - 1];
      while (top && top.type !== 'LPAREN') {
        outputQueue.push(operatorStack.pop()!);
        top = operatorStack[operatorStack.length - 1];
      }
      if (!top) {
        throw new Error("Syntax Error: Parentheses mismatch. Missing '('");
      }
      operatorStack.pop(); // discard the left parenthesis

      // If top is a function, push it to output outputQueue
      const funcToken = operatorStack[operatorStack.length - 1];
      if (funcToken && funcToken.type === 'FUNCTION') {
        outputQueue.push(operatorStack.pop()!);
      }
      expectTerm = false;
    } else if (token.type === 'OPERATOR') {
      let op = token.value;

      // Handle Unary Prefix Operators
      if (expectTerm) {
        if (op === '+') {
          // Unary plus is basically a no-op, discard it
          continue;
        } else if (op === '-') {
          op = 'U-'; // mark as Unary Minus
        } else if (op === '*') {
          throw new Error("Syntax Error: Leading multiplier '*' is invalid.");
        } else if (op === '/') {
          throw new Error("Syntax Error: Leading divisor '/' is invalid.");
        } else if (op === '^') {
          throw new Error("Syntax Error: Leading power symbol '^' is invalid.");
        }
      }

      let topOpTok = operatorStack[operatorStack.length - 1];
      while (
        topOpTok &&
        topOpTok.type === 'OPERATOR' &&
        (
          (OPERATOR_ASSOCIATIVITY[op] === 'L' && OPERATOR_PRECEDENCE[op] <= OPERATOR_PRECEDENCE[topOpTok.value]) ||
          (OPERATOR_ASSOCIATIVITY[op] === 'R' && OPERATOR_PRECEDENCE[op] < OPERATOR_PRECEDENCE[topOpTok.value])
        )
      ) {
        outputQueue.push(operatorStack.pop()!);
        topOpTok = operatorStack[operatorStack.length - 1];
      }

      operatorStack.push({ type: 'OPERATOR', value: op });
      expectTerm = true;
    }
  }

  while (operatorStack.length > 0) {
    const op = operatorStack.pop()!;
    if (op.type === 'LPAREN' || op.type === 'RPAREN') {
      throw new Error("Syntax Error: Balanced matching parentheses issue occurred.");
    }
    outputQueue.push(op);
  }

  return outputQueue;
}

export function evaluatePostfix(postfix: Token[], x: number): number {
  const stack: number[] = [];

  for (const token of postfix) {
    if (token.type === 'NUMBER') {
      stack.push(parseFloat(token.value));
    } else if (token.type === 'VARIABLE') {
      stack.push(x);
    } else if (token.type === 'OPERATOR') {
      if (token.value === 'U-') {
        if (stack.length < 1) throw new Error("Evaluation Error: No numeric operand for prefix minus.");
        const val = stack.pop()!;
        stack.push(-val);
      } else if (token.value === 'U+') {
        // Unary plus does nothing
        if (stack.length < 1) throw new Error("Evaluation Error: No numeric operand for prefix plus.");
      } else {
        if (stack.length < 2) throw new Error(`Evaluation Error: Stack underflow for operator "${token.value}"`);
        const op2 = stack.pop()!;
        const op1 = stack.pop()!;
        switch (token.value) {
          case '+': stack.push(op1 + op2); break;
          case '-': stack.push(op1 - op2); break;
          case '*': stack.push(op1 * op2); break;
          case '/':
            if (Math.abs(op2) < 1e-15) {
              // Devise division-by-zero protection. Bisection methods should recover.
              stack.push(op1 >= 0 ? Infinity : -Infinity);
            } else {
              stack.push(op1 / op2);
            }
            break;
          case '^': stack.push(Math.pow(op1, op2)); break;
          default: throw new Error(`Unknown operator "${token.value}"`);
        }
      }
    } else if (token.type === 'FUNCTION') {
      if (stack.length < 1) throw new Error(`Evaluation Error: Stack underflow evaluating function "${token.value}"`);
      const val = stack.pop()!;
      switch (token.value) {
        case 'sin': stack.push(Math.sin(val)); break;
        case 'cos': stack.push(Math.cos(val)); break;
        case 'tan': stack.push(Math.tan(val)); break;
        case 'exp': stack.push(Math.exp(val)); break;
        case 'log': stack.push(Math.log(val)); break;
        case 'log10': stack.push(Math.log10(val)); break;
        case 'sqrt':
          if (val < 0) throw new Error("Evaluation Error: Negative parameter passed to square root functions");
          stack.push(Math.sqrt(val));
          break;
        case 'abs': stack.push(Math.abs(val)); break;
        case 'sinh': stack.push(Math.sinh(val)); break;
        case 'cosh': stack.push(Math.cosh(val)); break;
        case 'tanh': stack.push(Math.tanh(val)); break;
        case 'asin': stack.push(Math.asin(val)); break;
        case 'acos': stack.push(Math.acos(val)); break;
        case 'atan': stack.push(Math.atan(val)); break;
        default: throw new Error(`Unknown function symbol reference "${token.value}"`);
      }
    }
  }

  if (stack.length !== 1) {
    throw new Error("Syntax Error: Insufficient parameters or invalid operator combinations.");
  }

  const ans = stack[0];
  if (isNaN(ans)) {
    throw new Error("Evaluation yielded NaN (Not a Number).");
  }
  return ans;
}

/**
 * High-level parser that compiles a math expression into a rapid evaluation function
 * or returns clean structural errors.
 */
export function compileExpression(expr: string): (x: number) => number {
  const tokens = tokenize(expr);
  const postfix = parseToPostfix(tokens);
  return (x: number) => {
    return evaluatePostfix(postfix, x);
  };
}
