import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { createUrl } from '../utils';
import { ValidatorLevel } from '../configuration';

export class DuplicateValuesValidator implements EntryResultValidator {
    foundValues = new Map<string, WalkerByIdResult>();

    constructor(private _level: ValidatorLevel) { }

    validate(result: WalkerByIdResult): WalkerByIdResult {
        if (!result.value) {
            return result;
        }
        const existingEntry = this.foundValues.get(result.value);
        if (existingEntry && existingEntry.id !== result.id) {
            return { ...result, state: this._level, message: `The translation with ID has the same value as <strong>${createUrl(existingEntry, res => res.id)}</strong>` };
        }

        this.foundValues.set(result.value, result);
        return result;
    }

    cleanup() {
        this.foundValues.clear();
    }
}
