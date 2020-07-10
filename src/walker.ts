import { ValidatorLevel } from './configuration';
import { i18nMatchPattern, iterateTreeResult } from './utils';
import { ParseTreeResult, Element, Text, Attribute } from '@angular/compiler';
interface WalkerBaseResult {
    id: string;
    occassion: number;
    element: Element;
    attribute?: Attribute;
}
interface WalkerSuccessResult extends WalkerBaseResult {
    value: string;
    state: 'success';
}
interface WalkerFailResult extends WalkerBaseResult {
    message: string;
    value?: string;
}
interface WalkerErrorResult extends WalkerFailResult {
    state: ValidatorLevel;
}


export type WalkerResult = WalkerSuccessResult | WalkerErrorResult;

export class Walker {
    #root: ParseTreeResult;
    constructor(root: ParseTreeResult) {
        this.#root = root;
    }

    private toStringElement(element: Element): string {
        let str = `<${element.name}`;
        for (let attr of element.attrs) {
            str += ` ${attr.name}${attr.value ? `="${attr.value}"` : ''}`;
        }
        str += '>';
        for (let child of element.children) {
            if (child instanceof Text) {
                str += child.value;
            } else if (child instanceof Element) {
                str += this.toStringElement(child);
            } else {
                throw new Error('Content of node could not be determined. An unknown child was found');
            }
        }
        str += `</${element.name}>`;
        return str;
    }

    private getContentForNode(element: Element): string {
        let str = '';
        for (let child of element.children) {
            if (child instanceof Text) {
                str += child.value;
            }
            else if (child instanceof Element) {
                str += this.toStringElement(child);
            } else {
                throw new Error('Content of node could not be determined. An unknown child was found');
            }
        }
        return str;
    }

    geti18nAttributes(): Array<WalkerResult> {
        const res: Array<WalkerResult> = [];

        for (var element of iterateTreeResult(this.#root)) {
            if (element instanceof Element) {
                for (let attr of element.attrs) {
                    const match = i18nMatchPattern.exec(attr.name);
                    if (match) {
                        const [, attributeName] = match;
                        const id = attr.value;
                        const occassion = res.filter(c => c.id === id).length;
                        if (attributeName) {
                            const attribute = element.attrs.find(at => at.name === attributeName);
                            if (attribute) {
                                res.push({ element, id, occassion, state: 'success', value: attribute.value, attribute });
                            } else {
                                res.push({ element, id, occassion, state: 'error', message: 'The i18n attribute was registered on a tag as attribute tag. However the matching attribute was not found!', attribute });
                            }
                        } else {
                            const content = this.getContentForNode(element);
                            res.push({ element, id, occassion, state: 'success', value: content.trim() });
                        }
                    }
                }
            }
        }

        return res;
    }

    // private searchNode(element: Node, result: Array<WalkerResult>) {
    //     if (!(element instanceof HTMLElement)) {
    //         return;
    //     }
    //     for (let key in element.attributes) {
    //         const match = i18nMatchPattern.exec(key);
    //         if (match) {
    //             const [, attribute] = match;
    //             const id = element.attributes[key];
    //             const occassion = result.filter(c => c.id === id).length;
    //             let value: string;
    //             if (attribute) {
    //                 value = element.attributes[attribute];
    //             } else {
    //                 value = element.innerHTML;
    //             }
    //             if (!value || value.trim().length === 0) {
    //                 if (attribute) {
    //                     result.push({ id, occassion, state: 'error', message: 'The i18n attribute was registered on a tag as attribute tag. However the matching attribute was not found!', attribute });
    //                 } else {
    //                     result.push({ id, occassion, state: 'error', message: 'The i18n attribute was registered on an element without any inner HTML', attribute });
    //                 }
    //             } else {
    //                 result.push({ id: element.attributes[key], occassion, value: value.trim(), state: 'success', attribute });
    //             }
    //         }
    //     }
    //     element.childNodes.forEach(child => this.searchNode(child, result));
    // }
}
