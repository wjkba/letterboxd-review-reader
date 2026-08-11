import { parse, type Node } from "node-html-parser";

export type ReviewFragment = string;

const blockTags = new Set(["p", "li", "blockquote", "pre", "h1", "h2", "h3", "h4", "h5", "h6"]);
const listTags = new Set(["ul", "ol"]);

function words(node: Node): number {
  return (node.textContent.match(/\S+/g) ?? []).length;
}

function wrap(node: Node, content: string): string {
  const source = node.toString();
  const open = source.indexOf(">");
  const close = source.lastIndexOf("</");
  if (open < 0) return source;
  return `${source.slice(0, open + 1)}${content}${close > open ? source.slice(close) : ""}`;
}

function wrapList(node: Node, content: string, itemOffset: number): string {
  const source = node.toString();
  const openEnd = source.indexOf(">");
  const close = source.lastIndexOf("</");
  if (openEnd < 0) return source;
  let opening = source.slice(0, openEnd + 1);
  if (itemOffset > 0 && /^<ol\b/i.test(opening)) {
    const startMatch = opening.match(/\sstart\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+))/i);
    const originalStart = startMatch
      ? Number.parseInt(startMatch[1] ?? startMatch[2] ?? startMatch[3] ?? "", 10)
      : 1;
    const start = Number.isFinite(originalStart) ? originalStart + itemOffset : 1 + itemOffset;
    if (startMatch) {
      opening = opening.replace(startMatch[0], ` start="${start}"`);
    } else {
      opening = `${opening.slice(0, -1)} start="${start}">`;
    }
  }
  return `${opening}${content}${close > openEnd ? source.slice(close) : ""}`;
}

function splitText(node: Node, count: number): [string, string] | null {
  const tokens = node.toString().match(/\s+|\S+/g) ?? [];
  let seen = 0;
  const boundary = tokens.findIndex((token) => {
    if (/\S/.test(token)) {
      if (seen === count) return true;
      seen += 1;
    }
    return false;
  });
  return boundary > 0 && boundary < tokens.length
    ? [tokens.slice(0, boundary).join(""), tokens.slice(boundary).join("")]
    : null;
}

function splitNode(node: Node, count: number): [string, string] | null {
  if (node.childNodes.length === 0) return splitText(node, count);
  const total = words(node);
  const tag = (node as { tagName?: string }).tagName?.toLowerCase() ?? "";
  if (listTags.has(tag)) {
    let seen = 0;
    let left = "";
    let right = "";
    let split = false;
    let completedItems = 0;
    // Only completed list items advance ordered-list numbering. Whitespace,
    // text nodes, and a partially split li never consume a number.
    for (const child of node.childNodes) {
      const childWords = words(child);
      const childTag = (child as { tagName?: string }).tagName?.toLowerCase() ?? "";
      if (split) right += child.toString();
      else if (seen + childWords <= count) {
        left += child.toString();
        seen += childWords;
        if (childTag === "li") completedItems += 1;
        if (seen === count && count < total) split = true;
      } else {
        const pieces = splitNode(child, count - seen);
        if (!pieces) return null;
        left += pieces[0];
        right += pieces[1];
        split = true;
      }
    }
    return split && left && right
      ? [wrapList(node, left, 0), wrapList(node, right, completedItems)]
      : null;
  }
  let seen = 0;
  let split = false;
  let left = "";
  let right = "";
  for (const child of node.childNodes) {
    const childWords = words(child);
    if (split) right += child.toString();
    else if (childWords === 0 || seen + childWords <= count) {
      left += child.toString();
      seen += childWords;
      if (seen === count && count < total) split = true;
    } else {
      const pieces = splitNode(child, count - seen);
      if (!pieces) return null;
      left += pieces[0];
      right += pieces[1];
      split = true;
      seen = count;
    }
  }
  return split && left && right ? [wrap(node, left), wrap(node, right)] : null;
}

export function getReviewFragments(html: string): ReviewFragment[] {
  const root = parse(html);
  const result: string[] = [];
  const visit = (node: Node): void => {
    const tag = (node as { tagName?: string }).tagName?.toLowerCase() ?? "";
    if (blockTags.has(tag)) { if (words(node)) result.push(node.toString()); return; }
    if (listTags.has(tag)) {
      if (words(node)) result.push(node.toString());
      return;
    }
    if (node.childNodes.length === 0) {
      if (node.toString().trim()) result.push(node.toString());
      return;
    }
    for (const child of node.childNodes) visit(child);
  };
  for (const child of root.childNodes) visit(child);
  return result.length ? result : (words(root) ? [root.toString()] : []);
}

export function splitFragmentAtWord(html: string, wordCount: number): [string, string] | null {
  const root = parse(html);
  const nodes = root.childNodes;
  if (nodes.length !== 1) return null;
  const tag = (nodes[0] as { tagName?: string }).tagName?.toLowerCase() ?? "";
  if ((!blockTags.has(tag) && !listTags.has(tag)) || wordCount < 1 || wordCount >= words(nodes[0])) return null;
  return splitNode(nodes[0], wordCount);
}

/** Compatibility names for reader consumers during the modular migration. */
export const getBlockFragments = getReviewFragments;
export const splitAtWordBoundary = splitFragmentAtWord;
export function countWords(html: string): number {
  return (parse(html).textContent.match(/\S+/g) ?? []).length;
}
