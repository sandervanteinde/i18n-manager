import { ExtensionContext, window, commands } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from './workspace-scanner';
import { Subject, merge } from 'rxjs';
import { distinctUntilChanged, skipWhile, takeUntil, map, takeWhile, filter, tap, withLatestFrom } from 'rxjs/operators';
import { combineLatest } from 'rxjs';
import { Configuration } from './configuration';


export class GlobalNotifications {
    private static _instance: GlobalNotifications = new GlobalNotifications();
    static activate(context: ExtensionContext) {
        let destroy$ = new Subject<void>();
        this._instance.start();
        Configuration.instance.notificationsConfiguration$.pipe(
            skipWhile(cfg => !cfg.showNotifications),
            takeUntil(destroy$)
        ).subscribe(config => {
            if (config.showNotifications) {
                GlobalNotifications._instance.enable();
            } else {
                GlobalNotifications._instance.disable();
            }

            context.subscriptions.push({
                dispose: () => {
                    this._instance.stop();
                    destroy$.next();
                    destroy$.complete();
                }
            });
        });
    }
    #enabled: boolean = false;
    #warningSubject$ = new Subject<number>();
    #errorSubject$ = new Subject<number>();
    #destroy$ = new Subject<void>();
    #lastValue: ReadonlyMap<string, WalkerByIdResult[]> | undefined;
    #onEnableValue$ = new Subject<ReadonlyMap<string, WalkerByIdResult[]>>();
    start() {
        const callback = (val: string | undefined) => {
            if (val) {
                commands.executeCommand('extension.i18n-manager');
            }
        };

        merge(
            WorkspaceScanner.instance.validatedResultsById$,
            this.#onEnableValue$
        ).pipe(
            tap(val => {
                if (!this.#enabled) {
                    this.#lastValue = val;
                }
            }),
            filter(() => this.#enabled),
            takeUntil(this.#destroy$)
        ).subscribe(res => {
            let warningCount = 0;
            let errorCount = 0;

            res.forEach((values, key) => {
                values.forEach(value => {
                    switch (value.state) {
                        case 'warning':
                            warningCount++;
                            break;
                        case 'error':
                            errorCount++;
                            break;
                    }
                });
            });

            this.#warningSubject$.next(warningCount);
            this.#errorSubject$.next(errorCount);
        });

        combineLatest(
            this.#warningSubject$.pipe(distinctUntilChanged()),
            this.#errorSubject$.pipe(distinctUntilChanged()),
            Configuration.instance.notificationsConfiguration$.pipe(map(x => x.minimumLevel), distinctUntilChanged())
        ).pipe(
            map(([warning, error, minimumLevel]) => ({ warning, error, minimumLevel })),
            skipWhile(({ warning, error, minimumLevel }) => minimumLevel === 'warning' ? warning + error === 0 : error === 0),
            filter(() => this.#enabled),
            takeUntil(this.#destroy$)
        ).subscribe(({ warning, error, minimumLevel }) => {
            if (warning > 0 && error > 0 && minimumLevel === 'warning') {
                window.showErrorMessage(`[i18n-manager]: There are ${error} errors and ${warning} warnings`, 'Open i18n manager').then(callback);
            } else if (warning > 0 && minimumLevel === 'warning') {
                window.showWarningMessage(`[i18n-manager]: There are ${warning} warnings`, 'Open i18n manager').then(callback);
            } else if (error > 0) {
                window.showErrorMessage(`[i18n-manager]: There are ${error} errors`, 'Open i18n manager').then(callback);
            } else {
                window.showInformationMessage(`[i18n-manager]: You resolved all ${minimumLevel === 'warning' ? 'warning/errors' : 'errors'}.`, 'Open i18n manager').then(callback);
            }
        });
    }

    stop() {
        this.#errorSubject$.complete();
        this.#warningSubject$.complete();
        this.#destroy$.next();
        this.#destroy$.complete();
    }

    enable() {
        this.#enabled = true;
        if (this.#lastValue) {
            this.#onEnableValue$.next(this.#lastValue);
            this.#lastValue = undefined;
        }
    }

    disable() {
        this.#enabled = false;
        this.#errorSubject$.next(0);
        this.#warningSubject$.next(0);
    }
}
