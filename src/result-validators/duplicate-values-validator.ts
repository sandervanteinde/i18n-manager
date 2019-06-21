import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { ResultValidatorContext } from '.';
import { WarningType } from '../warning-type';
import { createUrl } from '../utils';

export class DuplicateValuesValidator implements EntryResultValidator {
    foundValues = new Map<string, WalkerByIdResult>();
    validate(result: WalkerByIdResult, cotext: ResultValidatorContext): WalkerByIdResult {
        if (!result.value) {
            return result;
        }
        const existingEntry = this.foundValues.get(result.value);
        if(existingEntry && existingEntry.id !== result.id){
            return { ...result, state: 'warning', warning: WarningType.ValueExists, message: `The translation with ID has the same value as <strong>${createUrl(existingEntry, res => res.id)}</strong>` };
        }

        this.foundValues.set(result.value, result);
        return result;
    }

    cleanup() {
        this.foundValues.clear();
    }
}
