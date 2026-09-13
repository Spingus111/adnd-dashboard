import { secureRandomFloat } from "./random.ts";

export type DiceEvaluation = {
  source: string;
  label: string;
  total: number;
  lines: string[];
};

type Value = {
  total: number;
  values?: number[];
  display: string;
};

type DiceOptions = {
  explodeAt?: number;
  noSort: boolean;
  dropLow?: number;
  dropHigh?: number;
  keepLow?: number;
  keepHigh?: number;
  critAt?: number;
  allSameReroll?: boolean;
};

const MAX_DICE = 100;
const MAX_SIDES = 1000;
const MAX_REPEATS = 20;

function randomDie(size: number, random: () => number) {
  return Math.floor(random() * size) + 1;
}

function cleanNumber(value: number) {
  if (!Number.isFinite(value)) throw new Error("The roll produced an invalid number.");
  return Number.isInteger(value) ? String(value) : String(Math.round(value * 1000) / 1000);
}

class DiceParser {
  private position = 0;
  private readonly source: string;
  private readonly random: () => number;

  constructor(source: string, random: () => number) {
    this.source = source;
    this.random = random;
  }

  parse() {
    const value = this.parseComparison();
    this.skipSpaces();
    return { value, consumed: this.position };
  }

  private skipSpaces() {
    while (/\s/.test(this.source[this.position] ?? "")) this.position += 1;
  }

  private startsWith(token: string) {
    this.skipSpaces();
    return this.source.slice(this.position, this.position + token.length) === token;
  }

  private take(token: string) {
    if (!this.startsWith(token)) return false;
    this.position += token.length;
    return true;
  }

  private parseComparison(): Value {
    const left = this.parseAddition();
    const operators = ["<<", ">>", "<=", ">=", "<", ">", "="];
    const operator = operators.find((entry) => this.startsWith(entry));
    if (!operator) return left;
    this.take(operator);
    const right = this.parseAddition();
    const pool = left.values ?? [left.total];
    let total = 0;
    if (operator === "<<") total = pool.filter((value) => value <= right.total).length;
    else if (operator === ">>") total = pool.filter((value) => value >= right.total).length;
    else if (operator === "<") total = Number(left.total < right.total);
    else if (operator === "<=") total = Number(left.total <= right.total);
    else if (operator === ">") total = Number(left.total > right.total);
    else if (operator === ">=") total = Number(left.total >= right.total);
    else total = Number(left.total === right.total);
    return { total, display: `${left.display} ${operator} ${right.display} = ${total}` };
  }

  private parseAddition(): Value {
    let left = this.parseMultiplication();
    while (true) {
      this.skipSpaces();
      const operator = this.source.slice(this.position, this.position + 2) === "++"
        ? "++"
        : this.source.slice(this.position, this.position + 2) === "--"
          ? "--"
          : ["+", "-"].includes(this.source[this.position] ?? "")
            ? this.source[this.position]
            : "";
      if (!operator) return left;
      this.position += operator.length;
      const right = this.parseMultiplication();
      if (operator === "++" || operator === "--") {
        const modifier = operator === "++" ? right.total : -right.total;
        const values = (left.values ?? [left.total]).map((value) => value + modifier);
        left = { total: values.reduce((sum, value) => sum + value, 0), values, display: `${left.display} ${operator} ${right.display} → [${values.map(cleanNumber).join(", ")}]` };
      } else {
        const total = operator === "+" ? left.total + right.total : left.total - right.total;
        left = { total, display: `${left.display} ${operator} ${right.display}` };
      }
    }
  }

  private parseMultiplication(): Value {
    let left = this.parseUnary();
    while (true) {
      this.skipSpaces();
      const operator = ["*", "/"].includes(this.source[this.position] ?? "") ? this.source[this.position] : "";
      if (!operator) return left;
      this.position += 1;
      const right = this.parseUnary();
      if (operator === "/" && right.total === 0) throw new Error("Dice expressions cannot divide by zero.");
      left = { total: operator === "*" ? left.total * right.total : left.total / right.total, display: `${left.display} ${operator} ${right.display}` };
    }
  }

  private parseUnary(): Value {
    this.skipSpaces();
    if (this.take("+")) return this.parseUnary();
    if (this.take("-")) {
      const value = this.parseUnary();
      return { total: -value.total, display: `-${value.display}` };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Value {
    this.skipSpaces();
    if (this.take("(")) {
      const value = this.parseComparison();
      if (!this.take(")")) throw new Error("A closing parenthesis is missing.");
      return { ...value, display: `(${value.display})` };
    }

    const burning = this.source.slice(this.position).match(/^([BGW])(\d{1,3})(!?)/i);
    if (burning) {
      this.position += burning[0].length;
      const threshold = burning[1].toUpperCase() === "B" ? 4 : burning[1].toUpperCase() === "G" ? 3 : 2;
      const count = Math.max(1, Math.min(MAX_DICE, Number(burning[2])));
      const value = this.rollPool(count, 6, { explodeAt: burning[3] ? 6 : undefined, noSort: false });
      const successes = (value.values ?? []).filter((roll) => roll >= threshold).length;
      return { total: successes, values: value.values, display: `${burning[1].toUpperCase()}${count}${burning[3]} ${value.display} → ${successes} successes` };
    }

    const dice = this.source.slice(this.position).match(/^(\d{0,3})d(\d{1,4}|F)/i);
    if (dice) {
      this.position += dice[0].length;
      const count = Math.max(1, Math.min(MAX_DICE, Number(dice[1]) || 1));
      const fate = dice[2].toUpperCase() === "F";
      const sides = fate ? 3 : Math.max(2, Math.min(MAX_SIDES, Number(dice[2])));
      const options: DiceOptions = { noSort: false };
      while (true) {
        const suffix = this.source.slice(this.position);
        const explode = suffix.match(/^!(\d{1,4})?/i);
        const option = suffix.match(/^(ns|dl\d+|dh\d+|kl\d+|kh\d+|d\d+|k\d+|c\d+|daro|taro|aro)/i);
        if (explode) {
          options.explodeAt = explode[1] ? Number(explode[1]) : sides;
          this.position += explode[0].length;
        } else if (option) {
          const token = option[0].toLowerCase();
          this.position += option[0].length;
          if (token === "ns") options.noSort = true;
          else if (token.startsWith("dl") || /^d\d+$/.test(token)) options.dropLow = Number(token.replace(/^dl?/, ""));
          else if (token.startsWith("dh")) options.dropHigh = Number(token.slice(2));
          else if (token.startsWith("kl")) options.keepLow = Number(token.slice(2));
          else if (token.startsWith("kh") || /^k\d+$/.test(token)) options.keepHigh = Number(token.replace(/^kh?/, ""));
          else if (token.startsWith("c")) options.critAt = Number(token.slice(1));
          else options.allSameReroll = true;
        } else break;
      }
      const rolled = fate ? this.rollFate(count, options.noSort) : this.rollPool(count, sides, options);
      return { ...rolled, display: `${dice[1] || "1"}d${dice[2]} ${rolled.display}` };
    }

    const number = this.source.slice(this.position).match(/^\d+(?:\.\d+)?/);
    if (number) {
      this.position += number[0].length;
      return { total: Number(number[0]), display: number[0] };
    }
    throw new Error("Use dice notation such as d20, 2d6+3, 4d6kh3, or 6#4d6d1.");
  }

  private rollFate(count: number, noSort: boolean): Value {
    const values = Array.from({ length: count }, () => randomDie(3, this.random) - 2);
    if (!noSort) values.sort((a, b) => a - b);
    const symbols = values.map((value) => value === -1 ? "−" : value === 1 ? "+" : "0");
    return { total: values.reduce((sum, value) => sum + value, 0), values, display: `[${symbols.join(", ")}]` };
  }

  private rollPool(count: number, sides: number, options: DiceOptions): Value {
    const rolled = Array.from({ length: count }, () => randomDie(sides, this.random));
    if (options.allSameReroll && rolled.length > 1 && rolled.every((value) => value === rolled[0])) {
      rolled.push(...Array.from({ length: count }, () => randomDie(sides, this.random)));
    }
    if (options.explodeAt !== undefined) {
      let index = 0;
      while (index < rolled.length && rolled.length < MAX_DICE) {
        if (rolled[index] >= options.explodeAt) rolled.push(randomDie(sides, this.random));
        index += 1;
      }
    }
    const indexed = rolled.map((value, index) => ({ value, index, kept: true }));
    const ascending = [...indexed].sort((a, b) => a.value - b.value || a.index - b.index);
    const dropLow = Math.min(indexed.length, options.dropLow ?? 0);
    const dropHigh = Math.min(indexed.length - dropLow, options.dropHigh ?? 0);
    ascending.slice(0, dropLow).forEach((entry) => { entry.kept = false; });
    ascending.slice(Math.max(0, ascending.length - dropHigh)).forEach((entry) => { entry.kept = false; });
    const afterDrop = indexed.filter((entry) => entry.kept);
    if (options.keepLow !== undefined) {
      const keep = new Set([...afterDrop].sort((a, b) => a.value - b.value || a.index - b.index).slice(0, options.keepLow).map((entry) => entry.index));
      afterDrop.forEach((entry) => { if (!keep.has(entry.index)) entry.kept = false; });
    }
    if (options.keepHigh !== undefined) {
      const keep = new Set([...afterDrop].sort((a, b) => b.value - a.value || a.index - b.index).slice(0, options.keepHigh).map((entry) => entry.index));
      afterDrop.forEach((entry) => { if (!keep.has(entry.index)) entry.kept = false; });
    }
    const shown = options.noSort ? indexed : [...indexed].sort((a, b) => a.value - b.value || a.index - b.index);
    const display = `[${shown.map((entry) => {
      const value = options.critAt !== undefined && entry.value >= options.critAt ? `★${entry.value}` : String(entry.value);
      return entry.kept ? value : `(${value} dropped)`;
    }).join(", ")}]`;
    const values = indexed.filter((entry) => entry.kept).map((entry) => entry.value);
    return { total: values.reduce((sum, value) => sum + value, 0), values, display };
  }
}

function evaluateOne(source: string, random: () => number): DiceEvaluation {
  const parser = new DiceParser(source, random);
  const { value, consumed } = parser.parse();
  const label = source.slice(consumed).trim().replace(/^[:—-]\s*/, "");
  return {
    source: source.slice(0, consumed).trim(),
    label,
    total: value.total,
    lines: [value.display, `Total: ${cleanNumber(value.total)}`],
  };
}

export function looksLikeDice(value: string) {
  const trimmed = value.trim();
  if (/^\d{1,2}#\s*(?:\d{0,3}d(?:\d+|f)|[bgw]\d+)/i.test(trimmed)) return true;
  return /(?:^|\[|\s|[+\-*/(])(?:\d{0,3}d(?:\d+|f)|[bgw]\d+)/i.test(value);
}

export function evaluateDiceExpression(input: string, random: () => number = secureRandomFloat): DiceEvaluation[] {
  const trimmed = input.trim();
  if (!trimmed) throw new Error("Enter a dice expression.");
  const repeat = trimmed.match(/^(\d{1,2})#(.+)$/s);
  if (!repeat) return [evaluateOne(trimmed, random)];
  const count = Math.max(1, Math.min(MAX_REPEATS, Number(repeat[1])));
  return Array.from({ length: count }, (_, index) => {
    const result = evaluateOne(repeat[2], random);
    return { ...result, label: result.label || `Roll ${index + 1}` };
  });
}

export function evaluateInlineDice(input: string, random: () => number = secureRandomFloat) {
  const results: DiceEvaluation[] = [];
  const rendered = input.replace(/\[([^\]]+)\]/g, (match, expression: string) => {
    if (!looksLikeDice(expression)) return match;
    const evaluated = evaluateDiceExpression(expression, random);
    results.push(...evaluated);
    return `[${expression.trim()} → ${evaluated.map((entry) => cleanNumber(entry.total)).join(", ")}]`;
  });
  return { rendered, results };
}
