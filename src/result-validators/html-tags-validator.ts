import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { ValidatorLevel } from '../configuration';
import { Element, Text } from '@angular/compiler';
import { replaceI18nValuesById } from '../utils';

export class HtmlTagsValidator implements EntryResultValidator {
    constructor(private _level: ValidatorLevel) { }
    validate(entry: WalkerByIdResult): WalkerByIdResult {
        if (!entry.attribute && entry.element.children.some(x => x instanceof Element)) {
            return {
                ...entry,
                state: this._level,
                message: 'This translation contains HTML tag. This is not recommended!',
                fixer: {
                    getFixButtons: () => [{ label: 'Remove HTML', id: 'remove-html' }],
                    startFix: () => replaceI18nValuesById(entry.file, entry.id, this.elementWithoutHtmlTags(entry.element))
                }
            };
        }
        return entry;
    }

    private elementWithoutHtmlTags(element: Element): string {
        let str = '';
        for (let child of element.children) {
            if (child instanceof Text) {
                str += child.value;
            } else if (child instanceof Element) {
                str += this.elementWithoutHtmlTags(child);
            } else {
                throw new Error('Html fixer found an unknown element');
            }
        }
        return str;
    }
}
