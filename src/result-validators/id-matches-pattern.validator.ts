import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { ValidatorLevel } from '../configuration';

const regexMatch = /^@@[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/i;

export class IdMatchesPatternValidator implements EntryResultValidator {
    private _pattern: RegExp;
    constructor(
        private _level: ValidatorLevel,
        pattern: string
    ) {
        try {
            this._pattern = new RegExp(pattern);
        }
        catch (err) {
            console.error('[i18n-manager] Failed to parse id match pattern validator pattern');
            this._pattern = /^.+$/;
        }
    }
    validate(item: WalkerByIdResult): WalkerByIdResult {
        if (!this._pattern.exec(item.id)) {
            return { ...item, state: this._level, message: `The id ${item.id} does not match required pattern: ${this._pattern}` };
        }
        return item;
    }
}
