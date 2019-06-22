import { IdResultValidator } from './result-validator';
import { ResultValidatorContext } from './result-validator-context';
import { ValidatorLevel } from '../configuration';

export class NonMatchingIdValidator implements IdResultValidator {
    constructor(private _level: ValidatorLevel) { }

    validate(context: ResultValidatorContext): void {
        const { results } = context;
        const values = results.map(result => result.value).filter(Boolean) as string[];
        var stripped0 = this.strippedString(values[0]);
        if (values.length > 1 && values.some(value => this.strippedString(value) !== stripped0)) {
            for (let i = 0; i < values.length; i++) {
                results[i] = { ...results[i], state: this._level, message: 'There are other items registered with this ID whose value do not match!' };
            }
        }
    }

    private strippedString(str: string): string {
        if (!str) {
            return str;
        }
        return str.replace(/[\n\r]/gi, '').replace(/{{[^}]+}}/gi, '{}').replace(/ +/g, ' ');
    }
}
