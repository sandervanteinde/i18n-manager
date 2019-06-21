import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { WarningType } from '../warning-type';

const regexMatch = /^@@[a-z0-9]+_[a-z0-9]+_[a-z0-9]+$/i

export class IdMatchesPatternValidator implements EntryResultValidator {

    validate(item: WalkerByIdResult): WalkerByIdResult {
        if (!regexMatch.exec(item.id)) {
            return { ...item, state: 'warning', warning: WarningType.NotMatchingPattern, message: `The id ${item.id} does not match required pattern: ${regexMatch}`};
        }
        return item;
    }
}
