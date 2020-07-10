import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { ValidatorLevel } from '../configuration';

const regexMatch = /^@@[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/i;

export class IdMatchesPatternValidator implements EntryResultValidator {
    #pattern: RegExp;
    #level: ValidatorLevel;
    constructor(
        level: ValidatorLevel,
        pattern: string
    ) {
        this.#level = level;
        try {
            this.#pattern = new RegExp(pattern);
        }
        catch (err) {
            console.error('[i18n-manager] Failed to parse id match pattern validator pattern');
            this.#pattern = /^.+$/;
        }
    }
    validate(item: WalkerByIdResult): WalkerByIdResult {
        if (!this.#pattern.exec(item.id)) {
            return {
                ...item,
                state: this.#level,
                message: `The id ${item.id} does not match required pattern: ${this.#pattern}`
            };
        }
        return item;
    }
}
