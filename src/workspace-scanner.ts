import { workspace, Uri } from 'vscode';
import { parse } from 'node-html-parser';
import { Walker, WalkerResult } from './walker';
import { Observable, ReplaySubject, Subject, of, from } from 'rxjs';

export type WalkerByIdResult = WalkerResult & {
    file: Uri;
};

export class WorkspaceScanner {
    resultsByFile$ = new ReplaySubject<ReadonlyMap<Uri, WalkerResult[]>>(1);
    resultsById$ = new ReplaySubject<ReadonlyMap<String, WalkerByIdResult[]>>(1);

    private _state: 'uninitialized' | 'initializing' | 'initialized' = 'uninitialized';

    get initialized(): boolean { return this._state === 'initialized'; }

    static instance: WorkspaceScanner = new WorkspaceScanner();

    private constructor() {

    }

    private strippedString(str: string): string {
        if (!str) {
            return str;
        }
        return str.replace(/[\n\r]/gi, '').replace(/{{[^}]+}}/gi, '{}').replace(/ +/g, ' ');
    }

    initialize(): Observable<void> {
        if (this._state !== 'uninitialized') {
            return of(undefined);
        }
        console.log('[i18n-manager] initializing i18n repository');
        this._state = 'initializing';

        const resultByFileName = new Map<Uri, WalkerResult[]>();
        const resultById = new Map<String, WalkerByIdResult[]>();
        const finalizeSubject$ = new Subject<void>();

        workspace.findFiles('**/*.html').then(files => {
            const promises: Thenable<void>[] = [];
            files.forEach(uri => {
                promises.push(workspace.openTextDocument(uri).then(document => {
                    const text = document.getText();
                    if (!text) { return; }
                    const parsed = parse(text);
                    const walker = new Walker(parsed);
                    const walkerResults = walker.geti18nAttributes();
                    if (walkerResults.length > 0) {
                        resultByFileName.set(uri, walkerResults);
                        walkerResults.forEach(walkerResult => {
                            const entry = resultById.get(walkerResult.id);
                            const newRecord = { ...walkerResult, file: uri };
                            if (entry) {
                                entry.push(newRecord);
                            } else {
                                resultById.set(walkerResult.id, [newRecord]);
                            }
                        });
                    }
                }));
            });

            Promise.all(promises).then(() => {
                resultById.forEach((results, key) => {
                    const values = results.map(result => result.value).filter(Boolean) as string[];
                    var stripped0 = this.strippedString(values[0]);
                    if (values.length > 1 && values.some(value => this.strippedString(value) !== stripped0)) {
                        for (let i = 0; i < results.length; i++) {
                            results[i] = { ...results[i], success: false, error: 'There are other items registered with this ID whose value do not match!' };
                        }
                    }
                });
                this._state = 'initialized';
                this.resultsByFile$.next(resultByFileName);
                this.resultsById$.next(resultById);
                finalizeSubject$.next();
                finalizeSubject$.complete();
                console.log('[i18n-manager] initialized i18n repository');
            }).catch(err => {
                console.error(`[i18n-manager]: Failed to initialize i18n repository: ${err}`);
            });
        });
        return finalizeSubject$.asObservable();
    }
}
