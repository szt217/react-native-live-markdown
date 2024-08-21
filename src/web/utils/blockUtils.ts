import type {PartialMarkdownStyle} from '../../styleUtils';
import type {MarkdownRange} from './parserUtils';
import type {NodeType, TreeNode} from './treeUtils';

function addMarkdownStyleToRange(targetElement: HTMLElement, type: NodeType, markdownStyle: PartialMarkdownStyle) {
  const node = targetElement;
  switch (type) {
    case 'line':
      Object.assign(node.style, {
        display: 'block',
        margin: '0',
        padding: '0',
      });
      break;
    case 'syntax':
      Object.assign(node.style, markdownStyle.syntax);
      break;
    case 'bold':
      node.style.fontWeight = 'bold';
      break;
    case 'italic':
      node.style.fontStyle = 'italic';
      break;
    case 'strikethrough':
      node.style.textDecoration = 'line-through';
      break;
    case 'emoji':
      Object.assign(node.style, {...markdownStyle.emoji, verticalAlign: 'middle'});
      break;
    case 'mention-here':
      Object.assign(node.style, markdownStyle.mentionHere);
      break;
    case 'mention-user':
      Object.assign(node.style, markdownStyle.mentionUser);
      break;
    case 'mention-report':
      Object.assign(node.style, markdownStyle.mentionReport);
      break;
    case 'link':
      Object.assign(node.style, {
        ...markdownStyle.link,
        textDecoration: 'underline',
      });
      break;
    case 'code':
      Object.assign(node.style, markdownStyle.code);
      break;
    case 'pre':
      Object.assign(node.style, markdownStyle.pre);
      break;

    case 'blockquote':
      Object.assign(node.style, {
        ...markdownStyle.blockquote,
        borderLeftStyle: 'solid',
        display: 'inline-block',
        maxWidth: '100%',
        boxSizing: 'border-box',
      });
      break;
    case 'h1':
      Object.assign(node.style, {
        ...markdownStyle.h1,
        fontWeight: 'bold',
      });
      break;
    default:
      break;
  }
}

const BLOCK_MARKDOWN_TYPES = ['inline-image'];

function isBlockMarkdownType(type: NodeType) {
  return BLOCK_MARKDOWN_TYPES.includes(type);
}

function getFirstBlockMarkdownRange(ranges: MarkdownRange[]) {
  return ranges.find((r) => isBlockMarkdownType(r.type));
}

function extendBlockStructure(currentRange: MarkdownRange, targetNode: TreeNode, text: string, ranges: MarkdownRange[]) {
  switch (currentRange.type) {
    case 'inline-image':
      addInlineImagePreview(targetNode, text, ranges);
      break;
    default:
      break;
  }
}

function getImageMeta(url: string, callback: (err: string | Event | null, img?: HTMLImageElement) => void) {
  const img = new Image();
  img.onload = () => callback(null, img);
  img.onerror = (err) => callback(err);
  img.src = url;
}

function addInlineImagePreview(targetNode: TreeNode, text: string, ranges: MarkdownRange[]) {
  const linkRange = ranges.find((r) => r.type === 'link');
  let imageHref = '';
  if (linkRange) {
    imageHref = text.substring(linkRange.start, linkRange.start + linkRange.length);
  }

  Object.assign(targetNode.element.style, {
    display: 'block',
  });

  const maxWidth = 200;
  const maxHeight = 200;

  const orderIndex = targetNode.orderIndex;

  getImageMeta(imageHref, (_err, img) => {
    const element = document.querySelector(`[data-id="${orderIndex}"]`) as HTMLElement;
    if (!img || !element) {
      return;
    }

    const {naturalWidth, naturalHeight} = img;
    let width: number | null = null;
    let height: number | null = null;

    let paddingValue = 0;
    if (naturalWidth > naturalHeight) {
      width = Math.min(maxWidth, naturalWidth);
      paddingValue = (width / naturalWidth) * naturalHeight;
    } else {
      height = Math.min(maxHeight, naturalHeight);
      paddingValue = height;
    }

    const widthSize = width ? `${width}px` : 'auto';
    const heightSize = height ? `${height}px` : 'auto';

    Object.assign(element.style, {
      backgroundImage: `url("${imageHref}")`,
      backgroundPosition: `bottom left`,
      backgroundSize: `${widthSize} ${heightSize}`,
      backgroundRepeat: `no-repeat`,
      paddingBottom: `${paddingValue}px`,
    });
  });
}

export {addMarkdownStyleToRange, extendBlockStructure, isBlockMarkdownType, getFirstBlockMarkdownRange};