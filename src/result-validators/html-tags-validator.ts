import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { ValidatorLevel } from '../configuration';

export class HtmlTagsValidator implements EntryResultValidator {
    constructor(private _level: ValidatorLevel) { }
    validate(entry: WalkerByIdResult): WalkerByIdResult {
        if (entry.value && entry.value.indexOf('<') >= 0) {
            return { ...entry, state: this._level, message: 'This translation contains HTML tag. This is not recommended!' };
        }
        return entry;
    }
}
