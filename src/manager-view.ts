import { WebviewPanel, Uri, workspace, window } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from './workspace-scanner';
import { first, takeUntil } from 'rxjs/operators';
import { Subject, combineLatest } from 'rxjs';
import { WalkerResult } from './walker';
import { distinct, navigateToi18nTagInFile } from './utils';

export class ManagerView {
    private _scanner = WorkspaceScanner.instance;
    private _onDestroy$ = new Subject<void>();

    faultyResults = new Map<String, WalkerByIdResult[]>();
    successResults = new Map<String, WalkerByIdResult[]>();

    constructor(private _panel: WebviewPanel) { 
        _panel.webview.options = {
            ..._panel.webview.options,
            enableScripts: true
        };
        _panel.webview.onDidReceiveMessage(message => {
            if(message.command === 'navigateToFile'){
                const uri = Uri.parse(message.url);
                navigateToi18nTagInFile(uri, message.id);
            }
        });
    }

    initialize(): void {
        this.render();
        combineLatest(
            this._scanner.resultsById$,
        ).pipe(takeUntil(this._onDestroy$))
            .subscribe(([resultById]) => {
                resultById.forEach((values, id) => {
                    if (values.some(s => !s.success)) {
                        this.faultyResults.set(id, values);
                    } else {
                        this.successResults.set(id, values);
                    }
                });
                this.render();
            });
    }

    private styles() : string {
        return `
        <style>
            span.link {
                transition: 150ms;
            }

            span.link:hover{
                cursor: pointer;
                color: blue;
            }
        </style>`;
    }

    private scripts(): string {
        return `
        <script>
            const vscode = acquireVsCodeApi();
            const callback = event => {
                const { link, id } = event.target.dataset;
                vscode.postMessage({
                    command: 'navigateToFile',
                    url: link,
                    id
                });
            };
            document.querySelectorAll('span.link').forEach(linkTag => {
                linkTag.onclick = callback;
            });
        </script>`;
    }

    private render(): void {
        if (!this._panel.active) { return; }
        this._panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>i18n Manager</title>
                ${this.styles()}
            </head>
            <body>
                ${(this.successResults.size + this.faultyResults.size) > 0 ? this.renderBody() : this.renderLoading()}
            </body>
        </html>
        `;
    }

    private renderLoading(): string {
        return ` 
            <p>Files are being scanned...</p>
            <p>Please wait for the scanning to be finished</p>
        `;
    }

    private renderBody(): string {
        return ` 
            <h1>Found the following i18n tags in your project</h1>
            ${this.faultyResults.size > 0 ? this.failedEntriesTable() : ''}
            <table border="1">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Content</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(this.successResults.entries()).map(([id, results]) => this.successTableRow(id, results)).join('')}
                </tbody>
            </table>
            ${this.scripts()}
        `;
    }
    private failedEntriesTable(): string {
        return `
        <h2>The following tags were not valid!</h2>
        <table border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Content</th>
                    <th>Error</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(this.faultyResults.entries()).map(([id, results]) => this.failedTableRow(id, results)).join('')}
            </tbody>
        </table>`;
    }

    private failedTableRow(id: String, results: WalkerByIdResult[]) {
        const createHref = (result: WalkerByIdResult) => `<span class="link" data-id="${result.id}" data-link="${result.file}">${result.value}</span>`;
        return `
            <tr>
                <td>${id}</td>
                <td>
                    ${results.map(createHref).join('<br/>')}
                </td>
                <td style="color: red;">
                    ${distinct(results.map(r => !r.success && r.error)).join('<br/>')}
                </td>
            </tr>
        `;
    }

    private successTableRow(id: String, results: WalkerByIdResult[]) {
        const [first] = results;
        const result = first.success && first.value;
        return `
            <tr>
                <td>${id}</td>
                <td>
                    ${result}
                </td>
            </tr>
        `;
    }

    deactivate() {
        this._onDestroy$.next();
        this._onDestroy$.complete();
    }
}
