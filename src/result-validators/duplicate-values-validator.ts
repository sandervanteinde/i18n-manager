import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { createUrl, replaceI18nIdsById } from '../utils';
import { ValidatorLevel } from '../configuration';
import { Fixable } from './fixable';
import { Uri, window } from 'vscode';

export class DuplicateValuesValidator implements EntryResultValidator {
    foundValues = new Map<string, WalkerByIdResult>();
    #level: ValidatorLevel;

    constructor(level: ValidatorLevel) {
        this.#level = level;
     }

    validate(result: WalkerByIdResult): WalkerByIdResult {
        if (!result.value) {
            return result;
        }
        const existingEntry = this.foundValues.get(result.value);
        if (existingEntry && existingEntry.id !== result.id) {
            return {
                ...result,
                state: this.#level,
                message: `The translation with ID has the same value as <strong>${createUrl(existingEntry, res => res.id)}</strong>`,
                fixer: this.createFixer(result, existingEntry)
            };
        }

        this.foundValues.set(result.value, result);
        return result;
    }

    createFixer(result: WalkerByIdResult, existing: WalkerByIdResult): Fixable {
        return {
            getFixButtons: () => [
                { label: `Select id`, id: 'select-id' }
            ],
            startFix: () => {
                window.showQuickPick([existing.id as string, result.id as string]).then(selectedId => {
                    if (!selectedId) {
                        return;
                    }
                    let replace = result;
                    let replaceWith = existing;
                    if (selectedId === replace.id) {
                        [replace, replaceWith] = [replaceWith, replace];
                    }

                    for (let files of new Set(replace.allByIdResults.map(x => x.file.toString()))) {
                        let uri = Uri.parse(files);
                        replaceI18nIdsById(uri, replace.id, replaceWith.id);
                    }
                });
            }
        };
    }

    cleanup() {
        this.foundValues.clear();
    }
}
