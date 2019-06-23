import { WalkerByIdResult } from '../workspace-scanner';

export class ResultValidatorContext {
    constructor(readonly id: string, readonly results: WalkerByIdResult[]) {

    }
}
