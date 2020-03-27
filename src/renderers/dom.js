/* @flow */

import { ComponentNode, TextNode, type NodeRenderer, ElementNode } from '../node';
import { NODE_TYPE } from '../constants';
import { uniqueID } from '../util';

type DomNodeRenderer = NodeRenderer<ElementNode, HTMLElement>;
type DomTextRenderer = NodeRenderer<TextNode, Text>;
type DomComponentRenderer = NodeRenderer<ComponentNode<*>, HTMLElement | TextNode | $ReadOnlyArray<HTMLElement | TextNode> | void>;
type DomRenderer = DomComponentRenderer & DomNodeRenderer & DomTextRenderer;

const ELEMENT_TAG = {
    HTML:    'html',
    IFRAME:  'iframe',
    SCRIPT:  'script',
    NODE:    'node',
    DEFAULT: 'default'
};

const ELEMENT_PROP = {
    ID:         'id',
    INNER_HTML: 'innerHTML',
    EL:         'el'
};

function fixScripts(el : HTMLElement, doc : Document = window.document) {
    for (const script of el.querySelectorAll('script')) {
        const parentNode = script.parentNode;

        if (!parentNode) {
            continue;
        }

        const newScript = doc.createElement('script');
        // $FlowFixMe
        newScript.text = script.textContent;
        parentNode.replaceChild(newScript, script);
    }
}

function createElement(doc : Document, node : ElementNode) : HTMLElement {
    if (node.props[ELEMENT_PROP.EL]) {
        // $FlowFixMe
        return node.props[ELEMENT_PROP.EL];
    }

    return doc.createElement(node.name);
}

function createTextElement(doc : Document, node : TextNode) : Text {
    return doc.createTextNode(node.text);
}

function addProps(el : HTMLElement, node) {
    const props = node.props;

    for (const prop of Object.keys(props)) {
        const val = props[prop];

        if (val === null || typeof val === 'undefined' || prop === ELEMENT_PROP.EL || prop === ELEMENT_PROP.INNER_HTML) {
            continue;
        }

        if (prop.match(/^on[A-Z][a-z]/) && typeof val === 'function') {
            el.addEventListener(prop.slice(2).toLowerCase(), val);
        } else if (typeof val === 'string' || typeof val === 'number') {
            el.setAttribute(prop, val.toString());

        } else if (typeof val === 'boolean') {
            if (val === true) {
                el.setAttribute(prop, '');
            }
        }
    }

    if (el.tagName.toLowerCase() === ELEMENT_TAG.IFRAME && !props.id) {
        el.setAttribute(ELEMENT_PROP.ID, `jsx-iframe-${ uniqueID() }`);
    }
}
const ADD_CHILDREN : { [string] : (HTMLElement, ElementNode, DomNodeRenderer) => void } = {

    [ ELEMENT_TAG.IFRAME ]: (el, node) => {
        const firstChild = node.children[0];

        if (node.children.length !== 1 || !(firstChild && firstChild.type === NODE_TYPE.ELEMENT) || firstChild.name !== ELEMENT_TAG.HTML) {
            throw new Error(`Expected only single html element node as child of ${ ELEMENT_TAG.IFRAME } element`);
        }
    
        el.addEventListener('load', () => {

            // $FlowFixMe
            const win = el.contentWindow;
    
            if (!win) {
                throw new Error(`Expected frame to have contentWindow`);
            }

            const doc = win.document;
            const docElement = doc.documentElement;

            while (docElement.children && docElement.children.length) {
                docElement.removeChild(docElement.children[0]);
            }

            // eslint-disable-next-line no-use-before-define
            const child : HTMLElement = firstChild.render(dom({ doc }));
        
            while (child.children.length) {
                docElement.appendChild(child.children[0]);
            }
        });
    },

    [ ELEMENT_TAG.SCRIPT ]: (el, node) => {
        const firstChild = node.children[0];

        if (node.children.length !== 1 || !(firstChild && firstChild.type === NODE_TYPE.TEXT)) {
            throw new Error(`Expected only single text node as child of ${ ELEMENT_TAG.SCRIPT } element`);
        }
        
        // $FlowFixMe
        el.text = firstChild.text;
    },

    [ ELEMENT_TAG.DEFAULT ]: (el, node, renderer) => {
        for (const child of node.renderChildren(renderer)) {
            el.appendChild(child);
        }
    }
};

function addChildren(el : HTMLElement, node : ElementNode, doc : Document, renderer : DomNodeRenderer) {
    if (node.props.hasOwnProperty(ELEMENT_PROP.INNER_HTML)) {

        if (node.children.length) {
            throw new Error(`Expected no children to be passed when ${ ELEMENT_PROP.INNER_HTML } prop is set`);
        }

        const html = node.props[ELEMENT_PROP.INNER_HTML];

        if (typeof html !== 'string') {
            throw new TypeError(`${ ELEMENT_PROP.INNER_HTML } prop must be string`);
        }

        if (node.name === ELEMENT_TAG.SCRIPT) {
            // $FlowFixMe
            el.text = html;
        } else {
            el.innerHTML = html;
            fixScripts(el, doc);
        }

    } else {
        const addChildrenToElement = ADD_CHILDREN[node.name] || ADD_CHILDREN[ELEMENT_TAG.DEFAULT];
        addChildrenToElement(el, node, renderer);
    }
}

export function dom(opts? : { doc? : Document, transform?: (node: any) => any } = {}) : DomRenderer {
    const { doc = document, transform } = opts;
    
    const domRenderer : DomRenderer = (node) => {
        if (transform) {
            node = transform(node);
        }

        if (node.type === NODE_TYPE.COMPONENT) {
            return node.renderComponent(domRenderer);
        }
        
        if (node.type === NODE_TYPE.TEXT) {
            // $FlowFixMe
            return createTextElement(doc, node);
        }
        
        if (node.type === NODE_TYPE.ELEMENT) {
            const el = createElement(doc, node);
            addProps(el, node);
            addChildren(el, node, doc, domRenderer);
            // $FlowFixMe
            return el;
        }

        throw new TypeError(`Unhandleable node`);
    };

    return domRenderer;
}
