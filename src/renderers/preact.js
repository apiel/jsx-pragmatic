/* @flow */

import type { Node } from 'react'; // eslint-disable-line import/no-unresolved

import { ComponentNode, TextNode, ElementNode, type NodeRenderer, type NodePropsType } from '../node';
import { NODE_TYPE } from '../constants';

type PreactType = {|
    h : Function
|};

type PreactRenderer = NodeRenderer<ElementNode | TextNode | ComponentNode<*>, Node | string | null>;

function mapPreactProps(props : NodePropsType) : NodePropsType {
    const { innerHTML, ...remainingProps } = props;

    const dangerouslySetInnerHTML = innerHTML
        ? { __html: innerHTML }
        : null;

    return {
        dangerouslySetInnerHTML,
        ...remainingProps
    };
}

export function preact({ Preact, transform } : { Preact : PreactType, transform?: (node: any) => any } = {}) : PreactRenderer {
    if (!Preact) {
        throw new Error(`Must pass Preact library to react renderer`);
    }
    
    const reactRenderer = (node) => {
        if (transform) {
            node = transform(node);
        }

        if (node.type === NODE_TYPE.COMPONENT) {
            return Preact.h(() => (node.renderComponent(reactRenderer) || null), node.props, ...node.renderChildren(reactRenderer));
        }
        
        if (node.type === NODE_TYPE.ELEMENT) {
            return Preact.h(node.name, mapPreactProps(node.props), ...node.renderChildren(reactRenderer));
        }
        
        if (node.type === NODE_TYPE.TEXT) {
            return node.text;
        }

        throw new TypeError(`Unhandleable node`);
    };

    return reactRenderer;
}
