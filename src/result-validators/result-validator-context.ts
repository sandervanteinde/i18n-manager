import { WalkerResult } from '../walker';

export class ResultValidatorContext {
    constructor(readonly id: string, readonly results: WalkerResult[]) {

    }
}
