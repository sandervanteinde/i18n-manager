import { EntryResultValidator } from './result-validator';
import { WalkerByIdResult } from '../workspace-scanner';
import { createUrl, replaceI18nIdsById } from '../utils';
import { ValidatorLevel } from '../configuration';
import { Fixable } from './fixable';
import { Uri } from 'vscode';

export class DuplicateValuesValidator implements EntryResultValidator {
    foundValues = new Map<string, WalkerByIdResult>();

    constructor(private _level: ValidatorLevel) { }

    validate(result: WalkerByIdResult): WalkerByIdResult {
        if (!result.value) {
            return result;
        }
        const existingEntry = this.foundValues.get(result.value);
        if (existingEntry && existingEntry.id !== result.id) {
            return {
                ...result,
                state: this._level,
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
                { label: `Use ${result.id}`, id: 'use-result' },
                { label: `Use ${existing.id}`, id: 'use-existing' }
            ],
            startFix: (id: 'use-result' | 'use-existing') => {
                let replace = result;
                let replaceWith = existing;
                if (id === 'use-result') {
                    [replace, replaceWith] = [replaceWith, replace];
                }

                for (let files of new Set(replace.allByIdResults.map(x => x.file.toString()))) {
                    let uri = Uri.parse(files);
                    replaceI18nIdsById(uri, replace.id, replaceWith.id);
                }
            }
        }
    }

    cleanup() {
        this.foundValues.clear();
    }
}
