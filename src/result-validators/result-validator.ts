import { ResultValidatorContext } from './result-validator-context';
import { WalkerByIdResult } from '../workspace-scanner';


export interface BaseValidator {
    initialize?: () => void;
    cleanup?: () => void;
}

export interface IdResultValidator extends BaseValidator {
    validate(context: ResultValidatorContext): void;
}

export interface EntryResultValidator extends BaseValidator {
    validate(result: WalkerByIdResult, cotext: ResultValidatorContext): WalkerByIdResult;
}
