import { ExtensionContext, window, commands } from 'vscode';
import { WorkspaceScanner } from './workspace-scanner';
import { Subject } from 'rxjs';
import { distinctUntilChanged, skipWhile, takeUntil } from 'rxjs/operators';
import { combineLatest } from 'rxjs';


export class GlobalNotifications {
    static activate(context: ExtensionContext) {
        let destroy$ = new Subject<void>();
        let warningSubject$ = new Subject<number>();
        let errorSubject$ = new Subject<number>();

        const callback = (val: string | undefined) => {
            if(val) { 
                commands.executeCommand('extension.i18n-manager');
            }
        };

        WorkspaceScanner.instance.validatedResultsById$
            .pipe(takeUntil(destroy$))
            .subscribe(res => {
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

                warningSubject$.next(warningCount);
                errorSubject$.next(errorCount);
            });

        combineLatest(
            warningSubject$.pipe(distinctUntilChanged()),
            errorSubject$.pipe(distinctUntilChanged())
        ).pipe(
            skipWhile(([warning, error]) => warning + error === 0),
            takeUntil(destroy$)
        ).subscribe(([warnings, errors]) => {
            if (warnings > 0 && errors > 0) {
                window.showErrorMessage(`[i18n-manager]: There are ${errors} errors and ${warnings} warnings`, 'Open i18n manager').then(callback);
            } else if (warnings > 0) {
                window.showWarningMessage(`[i18n-manager]: There are ${warnings} warnings`, 'Open i18n manager').then(callback);
            } else if (errors > 0) {
                window.showErrorMessage(`[i18n-manager]: There are ${errors} errors`, 'Open i18n manager').then(callback);
            } else {
                window.showInformationMessage(`[i18n-manager]: You resolved all warnings/errors.`, 'Open i18n manager').then(callback);
            }
        });

        context.subscriptions.push({
            dispose: () => {
                warningSubject$.complete();
                errorSubject$.complete();
                destroy$.next();
                destroy$.complete();
            }
        });
    }
}
