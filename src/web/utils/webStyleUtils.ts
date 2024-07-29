/* eslint-disable @typescript-eslint/no-explicit-any */
import type {TextStyle} from 'react-native';
import type {MarkdownStyle} from '../../MarkdownTextInputDecoratorViewNativeComponent';
import {mergeMarkdownStyleWithDefault} from '../../styleUtils';
import type {PartialMarkdownStyle} from '../../styleUtils';
import type {MarkdownTextInputElement} from '../../MarkdownTextInput.web';

let createReactDOMStyle: (style: any) => any;
try {
  createReactDOMStyle =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native-web/dist/exports/StyleSheet/compiler/createReactDOMStyle').default;
} catch (e) {
  throw new Error('[react-native-live-markdown] Function `createReactDOMStyle` from react-native-web not found. Please make sure that you are using React Native Web 0.18 or newer.');
}

let preprocessStyle: (style: any) => any;
try {
  preprocessStyle =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native-web/dist/exports/StyleSheet/preprocess').default;
} catch (e) {
  throw new Error('[react-native-live-markdown] Function `preprocessStyle` from react-native-web not found.');
}

let dangerousStyleValue: (name: string, value: any, isCustomProperty: boolean) => any;
try {
  dangerousStyleValue =
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    require('react-native-web/dist/modules/setValueForStyles/dangerousStyleValue').default;
} catch (e) {
  throw new Error('[react-native-live-markdown] Function `dangerousStyleValue` from react-native-web not found.');
}

function processUnitsInMarkdownStyle(input: MarkdownStyle): MarkdownStyle {
  const output = JSON.parse(JSON.stringify(input));

  Object.keys(output).forEach((key) => {
    const obj = output[key];
    Object.keys(obj).forEach((prop) => {
      obj[prop] = dangerousStyleValue(prop, obj[prop], false);
    });
  });

  return output as MarkdownStyle;
}

function processMarkdownStyle(input: MarkdownStyle | undefined): MarkdownStyle {
  return processUnitsInMarkdownStyle(mergeMarkdownStyleWithDefault(input));
}

function parseToReactDOMStyle(style: TextStyle): any {
  return createReactDOMStyle(preprocessStyle(style));
}

const CUSTOM_WEB_STYLES_ID = 'LiveMarkdownCustomWebStyles';

function* generateUniqueId() {
  let idCounter = 0;
  while (true) {
    yield `live-markdown-input-${idCounter++}`;
  }
}

const idGenerator = generateUniqueId();

function configureCustomWebStylesheet() {
  if (document.getElementById(CUSTOM_WEB_STYLES_ID) !== null) {
    return;
  }

  const customStyleTag = document.createElement('style');
  customStyleTag.id = CUSTOM_WEB_STYLES_ID;

  document.head.appendChild(customStyleTag);
}

function handleCustomStyles(target: MarkdownTextInputElement, markdownStyle: PartialMarkdownStyle) {
  const line = target.querySelector('*[data-type="line"]:has(> *[data-type="pre"]) > span:first-child');
  const styleTag = document.getElementById(CUSTOM_WEB_STYLES_ID) as HTMLStyleElement;
  if (!line || !styleTag || Object.values(styleTag.sheet?.cssRules ?? {}).some((rule) => rule.selectorText === `.${target.uniqueId} [data-type="pre"]::before`)) {
    return;
  }

  const lineHeight = line.getBoundingClientRect()?.height;
  const preStyles = markdownStyle.pre;
  const padding = preStyles?.padding ?? 5;

  const beforeRule = `.${target.uniqueId} *[data-type='pre']::before {
      top: ${Math.floor(lineHeight)}px;
      padding: ${(padding - 1)?.toString()}px;
      background-color: ${(preStyles?.backgroundColor as string) ?? 'lightgray'};
      border-radius: ${preStyles?.borderRadius?.toString() ?? '4'}px;
      border-color: ${preStyles?.borderColor ?? 'grey'};
    }`;
  const firstSyntaxRule = `.${target.uniqueId} *[data-type='line'] *[data-type='syntax']:has(+ *[data-type='pre']) {
      transform: translate(-${padding}px, -${padding}px);
    }`;
  const secondSyntaxRule = `.${target.uniqueId} *[data-type='line'] *[data-type='pre'] + *[data-type='syntax'] {
      transform: translate(-${padding}px, ${padding}px);
    }`;
  const textRule = `.${target.uniqueId} *[data-type='line'] *[data-type='pre'] + *[data-type='syntax'] + *[data-type='text'] {
      transform: translate(-${padding}px, ${padding}px);
    }`;
  styleTag.sheet?.insertRule(beforeRule, 0);
  styleTag.sheet?.insertRule(firstSyntaxRule, 1);
  styleTag.sheet?.insertRule(secondSyntaxRule, 2);
  styleTag.sheet?.insertRule(textRule, 3);
}

export {parseToReactDOMStyle, processMarkdownStyle, configureCustomWebStylesheet, idGenerator, handleCustomStyles};
