import BrowserUtils from './browserUtils';
import type {MarkdownTextInputElement} from '../../MarkdownTextInput.web';
import {addNodeToTree, buildTree} from './treeUtils';
import type {NodeType, TreeNode} from './treeUtils';
import type {PartialMarkdownStyle} from '../../styleUtils';
import {getCurrentCursorPosition, moveCursorToEnd, setCursorPosition} from './cursorUtils';
import {addStyleToBlock} from './blockUtils';

type MarkdownType = 'bold' | 'italic' | 'strikethrough' | 'emoji' | 'link' | 'code' | 'pre' | 'blockquote' | 'h1' | 'syntax' | 'mention-here' | 'mention-user' | 'mention-report';

type MarkdownRange = {
  type: MarkdownType;
  start: number;
  length: number;
  depth?: number;
};

type Paragraph = {
  text: string;
  start: number;
  length: number;
  markdownRanges: MarkdownRange[];
};

function ungroupRanges(ranges: MarkdownRange[]): MarkdownRange[] {
  const ungroupedRanges: MarkdownRange[] = [];
  ranges.forEach((range) => {
    if (!range.depth) {
      ungroupedRanges.push(range);
    }
    const {depth, ...rangeWithoutDepth} = range;
    Array.from({length: depth!}).forEach(() => {
      ungroupedRanges.push(rangeWithoutDepth);
    });
  });
  return ungroupedRanges;
}

function splitTextIntoLines(text: string): Paragraph[] {
  let lineStartIndex = 0;
  const lines: Paragraph[] = text.split('\n').map((line) => {
    const lineObject: Paragraph = {
      text: line,
      start: lineStartIndex,
      length: line.length,
      markdownRanges: [],
    };
    lineStartIndex += line.length + 1; // Adding 1 for the newline character
    return lineObject;
  });

  return lines;
}

function mergeLinesWithMultilineTags(lines: Paragraph[], ranges: MarkdownRange[]) {
  let mergedLines = [...lines];
  const lineIndexes = mergedLines.map((_line, index) => index);

  ranges.forEach((range) => {
    const beginLineIndex = mergedLines.findLastIndex((line) => line.start <= range.start);
    const endLineIndex = mergedLines.findIndex((line) => line.start + line.length >= range.start + range.length);
    const correspondingLineIndexes = lineIndexes.slice(beginLineIndex, endLineIndex + 1);

    if (correspondingLineIndexes.length > 0) {
      const mainLineIndex = correspondingLineIndexes[0] as number;
      const mainLine = mergedLines[mainLineIndex] as Paragraph;

      mainLine.markdownRanges.push(range);

      const otherLineIndexes = correspondingLineIndexes.slice(1);
      otherLineIndexes.forEach((lineIndex) => {
        const otherLine = mergedLines[lineIndex] as Paragraph;

        mainLine.text += `\n${otherLine.text}`;
        mainLine.length += otherLine.length + 1;
        mainLine.markdownRanges.push(...otherLine.markdownRanges);
      });
      if (otherLineIndexes.length > 0) {
        mergedLines = mergedLines.filter((_line, index) => !otherLineIndexes.includes(index));
      }
    }
  });

  return mergedLines;
}

function appendNode(element: HTMLElement, parentTreeNode: TreeNode, type: NodeType, length: number) {
  const node = addNodeToTree(element, parentTreeNode, type, length);
  parentTreeNode.element.appendChild(element);
  return node;
}

function addBrElement(node: TreeNode) {
  const span = document.createElement('span');
  span.setAttribute('data-type', 'br');
  const spanNode = appendNode(span, node, 'br', 1);
  appendNode(document.createElement('br'), spanNode, 'br', 1);
  return spanNode;
}

function addTextToElement(node: TreeNode, text: string) {
  const lines = text.split('\n');
  lines.forEach((line, index) => {
    if (line !== '') {
      const span = document.createElement('span');
      span.setAttribute('data-type', 'text');
      span.appendChild(document.createTextNode(line));
      appendNode(span, node, 'text', line.length);
    }

    if (index < lines.length - 1 || (index === 0 && line === '')) {
      addBrElement(node);
    }
  });
}

function addParagraph(node: TreeNode, text: string | null = null, length: number, disableInlineStyles = false) {
  const p = document.createElement('p');
  p.setAttribute('data-type', 'line');
  if (!disableInlineStyles) {
    addStyleToBlock(p, 'line', {});
  }

  const pNode = appendNode(p, node, 'line', length);

  if (text === '') {
    addBrElement(pNode);
  } else if (text) {
    addTextToElement(pNode, text);
  }

  return pNode;
}

function parseRangesToHTMLNodes(text: string, ranges: MarkdownRange[], markdownStyle: PartialMarkdownStyle = {}, disableInlineStyles = false) {
  const rootElement: HTMLElement = document.createElement('div');
  const textLength = text.replace(/\n/g, '\\n').length;

  const rootNode: TreeNode = {
    element: rootElement,
    start: 0,
    length: textLength,
    parentNode: null,
    childNodes: [],
    type: 'text',
    orderIndex: '',
    isGeneratingNewline: false,
  };
  let currentParentNode: TreeNode = rootNode;

  let lines = splitTextIntoLines(text);

  if (ranges.length === 0) {
    lines.forEach((line) => {
      addParagraph(rootNode, line.text, line.length, disableInlineStyles);
    });

    return rootElement;
  }

  const markdownRanges = ungroupRanges(ranges);

  lines = mergeLinesWithMultilineTags(lines, markdownRanges);

  let lastRangeEndIndex = 0;
  while (lines.length > 0) {
    const line = lines.shift();
    if (!line) {
      break;
    }

    // preparing line paragraph element for markdown text
    currentParentNode = addParagraph(rootNode, null, line.length, disableInlineStyles);
    if (line.markdownRanges.length === 0) {
      addTextToElement(currentParentNode, line.text);
    }

    lastRangeEndIndex = line.start;

    const lineMarkdownRanges = line.markdownRanges;
    // go through all markdown ranges in the line
    while (lineMarkdownRanges.length > 0) {
      const range = lineMarkdownRanges.shift();
      if (!range) {
        break;
      }

      const endOfCurrentRange = range.start + range.length;
      const nextRangeStartIndex = lineMarkdownRanges.length > 0 && !!lineMarkdownRanges[0] ? lineMarkdownRanges[0].start || 0 : textLength;

      // add text before the markdown range
      const textBeforeRange = line.text.substring(lastRangeEndIndex - line.start, range.start - line.start);
      if (textBeforeRange) {
        addTextToElement(currentParentNode, textBeforeRange);
      }

      // create markdown span element
      const span = document.createElement('span');
      span.setAttribute('data-type', range.type);
      if (!disableInlineStyles) {
        addStyleToBlock(span, range.type, markdownStyle);
      }

      const spanNode = appendNode(span, currentParentNode, range.type, range.length);

      if (lineMarkdownRanges.length > 0 && nextRangeStartIndex < endOfCurrentRange && range.type !== 'syntax') {
        // tag nesting
        currentParentNode = spanNode;
        lastRangeEndIndex = range.start;
      } else {
        // adding markdown tag
        addTextToElement(spanNode, text.substring(range.start, endOfCurrentRange));
        lastRangeEndIndex = endOfCurrentRange;
        // tag unnesting and adding text after the tag
        while (currentParentNode.parentNode !== null && nextRangeStartIndex >= currentParentNode.start + currentParentNode.length) {
          const textAfterRange = line.text.substring(lastRangeEndIndex - line.start, currentParentNode.start - line.start + currentParentNode.length);
          if (textAfterRange) {
            addTextToElement(currentParentNode, textAfterRange);
          }
          lastRangeEndIndex = currentParentNode.start + currentParentNode.length;
          currentParentNode = currentParentNode.parentNode || rootNode;
        }
      }
    }
  }

  return rootElement;
}

function moveCursor(isFocused: boolean, alwaysMoveCursorToTheEnd: boolean, cursorPosition: number | null, target: MarkdownTextInputElement) {
  if (!isFocused) {
    return;
  }

  if (alwaysMoveCursorToTheEnd || cursorPosition === null) {
    moveCursorToEnd(target);
  } else if (cursorPosition !== null) {
    setCursorPosition(target, cursorPosition);
  }
}

function updateInputStructure(
  target: MarkdownTextInputElement,
  text: string,
  cursorPositionIndex: number | null,
  markdownStyle: PartialMarkdownStyle = {},
  alwaysMoveCursorToTheEnd = false,
) {
  const targetElement = target;

  // in case the cursorPositionIndex is larger than text length, cursorPosition will be null, i.e: move the caret to the end
  let cursorPosition: number | null = cursorPositionIndex !== null && cursorPositionIndex <= text.length ? cursorPositionIndex : null;
  const isFocused = document.activeElement === target;
  if (isFocused && cursorPositionIndex === null) {
    const selection = getCurrentCursorPosition(target);
    cursorPosition = selection ? selection.start : null;
  }
  const ranges = global.parseExpensiMarkToRanges(text);
  const markdownRanges: MarkdownRange[] = ranges as MarkdownRange[];
  let tree: TreeNode | null = null;
  if (!text || targetElement.innerHTML === '<br>' || (targetElement && targetElement.innerHTML === '\n')) {
    targetElement.innerHTML = '';
    targetElement.innerText = '';
  }

  // We don't want to parse text with single '\n', because contentEditable represents it as invisible <br />
  if (text) {
    const dom = parseRangesToHTMLNodes(text, markdownRanges, markdownStyle);

    if (targetElement.innerHTML !== dom.innerHTML) {
      targetElement.innerHTML = '';
      targetElement.innerText = '';
      targetElement.innerHTML = dom.innerHTML || '';

      tree = buildTree(targetElement, text);
      targetElement.tree = tree;

      if (BrowserUtils.isChromium) {
        moveCursor(isFocused, alwaysMoveCursorToTheEnd, cursorPosition, target);
      }
    }

    if (!BrowserUtils.isChromium) {
      moveCursor(isFocused, alwaysMoveCursorToTheEnd, cursorPosition, target);
    }
  }

  return {text, cursorPosition: cursorPosition || 0};
}

export {updateInputStructure, parseRangesToHTMLNodes};

export type {MarkdownRange, MarkdownType};