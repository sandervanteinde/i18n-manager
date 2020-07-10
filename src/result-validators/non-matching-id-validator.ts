import { IdResultValidator } from './result-validator';
import { ResultValidatorContext } from './result-validator-context';
import { ValidatorLevel } from '../configuration';
import { WalkerByIdResult } from '../workspace-scanner';
import { FixableButton } from './fixable';
import { window, Uri } from 'vscode';
import { replaceI18nValuesById } from '../utils';

export class NonMatchingIdValidator implements IdResultValidator {
    #level: ValidatorLevel;
    constructor(level: ValidatorLevel) {
        this.#level = level;
    }

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
                    state: this.#level,
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
        return () => [{
            label: `Select value`,
            id: 'select-value'
        }];
    }

    private createFixCallback(id: string, results: WalkerByIdResult[]): (id: string) => void {
        const useCustomMsg = 'Use custom message';
        const doReplace = (newValue: string) => {

            for (let file of new Set(results.filter(res => res.value !== newValue).map(res => res.file.toString()))) {
                replaceI18nValuesById(Uri.parse(file), id, newValue);
            }
        };
        return () => {
            let set = new Set(results.filter(Boolean).map(x => x.value as string));
            window.showQuickPick([...Array.from(set), useCustomMsg]).then(newValue => {
                if (!newValue) {
                    return;
                }
                if (newValue === useCustomMsg) {
                    window.showInputBox({ prompt: `Give new content for the i18n id ${id}`, value: results[0].value }).then(inputValue => {
                        if (inputValue) {
                            doReplace(inputValue);
                        }
                    });
                } else {
                    doReplace(newValue);
                }
            });
        };
    }

    private strippedString(str: string): string {
        if (!str) {
            return str;
        }
        return str.replace(/[\n\r]/gi, '').replace(/{{[^}]+}}/gi, '{}').replace(/ +/g, ' ');
    }
}
