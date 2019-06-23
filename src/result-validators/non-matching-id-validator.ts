import { IdResultValidator } from './result-validator';
import { ResultValidatorContext } from './result-validator-context';
import { ValidatorLevel } from '../configuration';
import { WalkerByIdResult } from '../workspace-scanner';
import { FixableButton } from './fixable';
import { window, Uri } from 'vscode';
import { replaceI18nValuesById } from '../utils';

export class NonMatchingIdValidator implements IdResultValidator {
    constructor(private _level: ValidatorLevel) { }

    validate(context: ResultValidatorContext): void {
        const { results } = context;
        const values = results.map(result => result.value).filter(Boolean) as string[];
        var stripped0 = this.strippedString(values[0]);
        if (values.length > 1 && values.some(value => this.strippedString(value) !== stripped0)) {
            const fixButtons = this.createButtonCallback(results);
            const doFix = this.createFixCallback(results[0].id, results);
            for (let i = 0; i < values.length; i++) {
                results[i] = {
                    ...results[i],
                    state: this._level,
                    message: 'There are other items registered with this ID whose value do not match!',
                    fixer: {
                        getFixButtons: fixButtons,
                        startFix: doFix
                    }
                };
            }
        }
    }

    private createButtonCallback(values: WalkerByIdResult[]): () => FixableButton[] {
        return () => values.map((value, index) => ({
            label: `Use <strong>${value.value}</strong>`,
            id: index.toString()
        }));
    }

    private createFixCallback(id: string, results: WalkerByIdResult[]): (id: string) => void {
        return buttonId => {
            const value = results[Number(buttonId)].value;
            if (!value) {
                return;
            }
            for (let file of new Set(results.filter(res => res.value !== value).map(res => res.file.toString()))) {
                replaceI18nValuesById(Uri.parse(file), id, value);
            }
        };
    }

    private strippedString(str: string): string {
        if (!str) {
            return str;
        }
        return str.replace(/[\n\r]/gi, '').replace(/{{[^}]+}}/gi, '{}').replace(/ +/g, ' ');
    }
}
