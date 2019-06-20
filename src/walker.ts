import { HTMLElement, Node } from 'node-html-parser';
interface WalkerBaseResult {
    id: string;
    attribute?: string;
}
interface WalkerSuccessResult extends WalkerBaseResult {
    value: string;
    success: true;
}
interface WalkerFailResult extends WalkerBaseResult {
    success: false;
    error: string;
    value?: string;
}
export type WalkerResult = WalkerSuccessResult | WalkerFailResult;

const i18nMatchPattern = /i18n(?:-([^=]+))?/;

export class Walker {
    constructor(private _root: Node) {

    }

    geti18nAttributes(): Array<WalkerResult> {
        const res: Array<WalkerResult> = [];

        this.searchNode(this._root, res);

        return res;
    }

    private searchNode(element: Node, result: Array<WalkerResult>) {
        if (!(element instanceof HTMLElement)) {
            return;
        }
        for (let key in element.attributes) {
            const match = i18nMatchPattern.exec(key);
            if (match) {
                const [, attribute] = match;
                const id = element.attributes[key];
                let value: string;
                if (attribute) {
                    value = element.attributes[attribute];
                } else {
                    value = element.innerHTML;
                }
                if (!value || value.trim().length === 0) {
                    if (attribute) {
                        result.push({ id, success: false, error: 'The i18n attribute was registered on a tag as attribute tag. However the matching attribute was not found!', attribute });
                    } else {
                        result.push({ id, success: false, error: 'The i18n attribute was registered on an element without any inner HTML', attribute });
                    }
                } else {
                    result.push({ id: element.attributes[key], value: value.trim(), success: true, attribute });
                }
            }
        }
        element.childNodes.forEach(child => this.searchNode(child, result));
    }
}
