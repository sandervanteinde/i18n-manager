import { workspace, Uri, ExtensionContext, TextDocument } from 'vscode';
import { Walker, WalkerResult } from './walker';
import { Observable, ReplaySubject, Subject, of, from, combineLatest } from 'rxjs';
import { takeUntil, map, share, shareReplay, combineLatest as combineLatestOp } from 'rxjs/operators';
import { HtmlTagsValidator, IdMatchesPatternValidator, DuplicateValuesValidator, NonMatchingIdValidator, IdResultValidator, ResultValidatorContext, EntryResultValidator, BaseValidator, InterpolationValidator } from './result-validators';
import { Configuration, ValidatorConfiguration } from './configuration';
import { Fixable } from './result-validators/fixable';
import { toTokens } from './utils';

export type WalkerByIdResult = WalkerResult & {
    file: Uri;
    fixer?: Fixable
    allByIdResults: WalkerByIdResult[];
};

export class WorkspaceScanner {
    private static _instance: WorkspaceScanner | undefined;

    static get instance(): WorkspaceScanner {
        if (!WorkspaceScanner._instance) {
            WorkspaceScanner._instance = new WorkspaceScanner();
        }
        return WorkspaceScanner._instance;
    }


    #resultsByFile$ = new ReplaySubject<ReadonlyMap<string, WalkerResult[]>>(1);
    #resultsById$ = new ReplaySubject<ReadonlyMap<string, WalkerByIdResult[]>>(1);

    #resultsByFile: ReadonlyMap<string, WalkerResult[]> | undefined;
    #resultsById: ReadonlyMap<string, WalkerByIdResult[]> | undefined;

    #state: 'uninitialized' | 'initializing' | 'initialized' = 'uninitialized';
    #onDestroy$ = new Subject<void>();

    readonly resultsByFile$ = this.#resultsByFile$.asObservable();
    readonly resultsById$ = this.#resultsById$.asObservable();

    readonly validatedResultsById$ = this.#resultsById$.pipe(
        combineLatestOp(Configuration.instance.validatorConfiguration$),
        map(([res, config]) => {
            const { idValidators, entryValidators, validators } = this.getValidatorsByConfig(config);
            for (const validator of validators) {
                if (validator.initialize) {
                    validator.initialize();
                }
            }
            var copy = new Map<string, WalkerByIdResult[]>(res);
            copy.forEach((results, key) => {
                var resultsCopy = [...results];
                var ctx = new ResultValidatorContext(key, resultsCopy);
                for (let resultValidator of idValidators) {
                    resultValidator.validate(ctx);
                }
                resultsCopy.forEach((res, index) => {
                    for (let resultValidator of entryValidators) {
                        if (res.state !== 'success') {
                            return;
                        }
                        const replace = resultValidator.validate(res, ctx);
                        if (replace !== res) {
                            resultsCopy[index] = replace;
                        }
                    }
                });
                copy.set(key, resultsCopy);
            });

            for (const validator of validators) {
                if (validator.cleanup) {
                    validator.cleanup();
                }
            }
            return copy as ReadonlyMap<string, WalkerByIdResult[]>;
        }),
        shareReplay(1),
        takeUntil(this.#onDestroy$)
    );

    get initialized(): boolean { return this.#state === 'initialized'; }

    private constructor() {
        this.resultsByFile$.pipe(takeUntil(this.#onDestroy$)).subscribe(res => this.#resultsByFile = res);
        this.resultsById$.pipe(takeUntil(this.#onDestroy$)).subscribe(res => this.#resultsById = res);
    }

    private onDocumentSave(document: TextDocument): void {
        if (!document.uri.path.endsWith('.html')) { return; }
        // we didn't initialize for some reason?
        if (!this.#resultsByFile || !this.#resultsById) { return console.error('[i18n-manager] We were not able to handle a saved document'); }

        const results = this.getI18nResultsForFile(document);
        var newFileMap = new Map<string, WalkerResult[]>(this.#resultsByFile);
        newFileMap.set(document.uri.toString(), results);

        const newIdMap = new Map<string, WalkerByIdResult[]>(this.#resultsById);

        // remove old id maps
        const oldRegistry = this.#resultsByFile.get(document.uri.toString());
        if (oldRegistry) {
            oldRegistry.forEach(res => {
                const entry = newIdMap.get(res.id);
                if (entry) {
                    const fileIndex = entry.findIndex(c => c.file.toString() === document.uri.toString());
                    if (fileIndex !== -1) {
                        entry.splice(fileIndex, 1);
                        if (entry.length === 0) {
                            newIdMap.delete(res.id);
                        }
                    }
                }
            });
        }

        // add new id maps
        results.forEach(res => {
            const entry = newIdMap.get(res.id) || [];
            const newRecord = { ...res, file: document.uri, allByIdResults: entry };
            entry.push(newRecord);
            newIdMap.set(res.id, entry);
        });

        this.#resultsByFile$.next(newFileMap);
        this.#resultsById$.next(newIdMap);
    }

    private registerEvents(context: ExtensionContext): void {
        const savedDocumentSubject = new Subject<TextDocument>();
        const disposable = workspace.onDidSaveTextDocument(doc => {
            if (this.#state === 'initialized') {
                savedDocumentSubject.next(doc);
            } else {
                let interval: undefined | NodeJS.Timeout;
                interval = setInterval(() => {
                    if (this.#state === 'initialized') {
                        savedDocumentSubject.next(doc);
                        if (interval) { clearInterval(interval); }
                    }
                }, 1000);
            }
        });
        savedDocumentSubject.pipe(takeUntil(this.#onDestroy$)).subscribe(savedTextDocument => this.onDocumentSave(savedTextDocument));

        context.subscriptions.push(disposable);
    }

    private getI18nResultsForFile(document: TextDocument): WalkerResult[] {
        const parsed = toTokens(document);
        const walker = new Walker(parsed);
        return walker.geti18nAttributes();
    }


    getValidatorsByConfig(config: Readonly<ValidatorConfiguration>): { entryValidators: EntryResultValidator[], idValidators: IdResultValidator[], validators: BaseValidator[] } {
        var entryValidators: EntryResultValidator[] = [];
        var idValidators: IdResultValidator[] = [];
        if (config.duplicateValues.enabled) {
            entryValidators.push(new DuplicateValuesValidator(config.duplicateValues.level));
        }
        if (config.idMustMatchRegex.enabled) {
            entryValidators.push(new IdMatchesPatternValidator(config.idMustMatchRegex.level, config.idMustMatchRegex.pattern));
        }
        if (config.mismatchingValues.enabled) {
            idValidators.push(new NonMatchingIdValidator(config.mismatchingValues.level));
        }
        if (config.warnForHtmlTags.enabled) {
            entryValidators.push(new HtmlTagsValidator(config.warnForHtmlTags.level));
        }
        if (config.warnForInterpolations.enabled) {
            entryValidators.push(new InterpolationValidator(config.warnForInterpolations.level));
        }
        return {
            entryValidators: entryValidators,
            idValidators: idValidators,
            validators: [...entryValidators, ...idValidators]
        };
    }

    initialize(context: ExtensionContext): Observable<void> {
        if (this.#state !== 'uninitialized') {
            return of(undefined);
        }
        console.log('[i18n-manager] initializing i18n repository');
        this.registerEvents(context);
        this.#state = 'initializing';

        const resultByFileName = new Map<string, WalkerResult[]>();
        const resultById = new Map<string, WalkerByIdResult[]>();
        const finalizeSubject$ = new Subject<void>();

        workspace.findFiles('**/*.html').then(files => {
            const promises: Thenable<void>[] = [];
            files.forEach(uri => {
                if(uri.path.indexOf('node_modules') >= 0) { return; }
                promises.push(workspace.openTextDocument(uri).then(document => {
                    const walkerResults = this.getI18nResultsForFile(document);
                    if (walkerResults.length > 0) {
                        resultByFileName.set(uri.toString(), walkerResults);
                        walkerResults.forEach(walkerResult => {
                            const entry = resultById.get(walkerResult.id) || [];
                            const newRecord = { ...walkerResult, file: uri, allByIdResults: entry };
                            entry.push(newRecord);
                            resultById.set(walkerResult.id, entry);
                        });
                    }
                }));
            });

            Promise.all(promises).then(() => {
                this.#state = 'initialized';
                this.#resultsByFile$.next(resultByFileName);
                this.#resultsById$.next(resultById);
                finalizeSubject$.next();
                finalizeSubject$.complete();
                console.log('[i18n-manager] initialized i18n repository');
            }).catch(err => {
                console.error(`[i18n-manager]: Failed to initialize i18n repository: ${err}`);
            });
        });
        return finalizeSubject$.asObservable();
    }

    static deactivate() {
        if (!this._instance) {
            return;
        }
        this._instance.#resultsByFile$.complete();
        this._instance.#resultsById$.complete();
        this._instance.#onDestroy$.next();
        this._instance.#onDestroy$.complete();
        this._instance = undefined;
    }
}
