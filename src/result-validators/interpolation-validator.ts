import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { ValidatorLevel } from '../configuration';
import { Element } from '@angular/compiler';

export class InterpolationValidator implements EntryResultValidator {
    #level: ValidatorLevel;
    constructor(level: ValidatorLevel) { 
        this.#level = level;
    }
    validate(entry: WalkerByIdResult): WalkerByIdResult {
        if (entry.value && entry.value.includes('{{')) {
            return {
                ...entry,
                state: this.#level,
                message: 'This translation contains interpolations. This is not recommended!'
            };
        }
        return entry;
    }
}
