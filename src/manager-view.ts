import { WebviewPanel, Uri, workspace, window } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from './workspace-scanner';
import { first, takeUntil } from 'rxjs/operators';
import { Subject, combineLatest } from 'rxjs';
import { WalkerResult } from './walker';
import { distinct, navigateToi18nTagInFile } from './utils';

export class ManagerView {
    private _scanner = WorkspaceScanner.instance;
    private _onDestroy$ = new Subject<void>();
    private _dirty = false;

    errorResults = new Map<String, WalkerByIdResult[]>();
    warningResults = new Map<String, WalkerByIdResult[]>();
    successResults = new Map<String, WalkerByIdResult[]>();

    constructor(private _panel: WebviewPanel) {
        _panel.webview.options = {
            ..._panel.webview.options,
            enableScripts: true
        };
        _panel.webview.onDidReceiveMessage(message => {
            if (message.command === 'navigateToFile') {
                const uri = Uri.parse(message.url);
                navigateToi18nTagInFile(uri, message.id, Number(message.occassion));
            }
        });
        _panel.onDidChangeViewState(state => {
            if (state.webviewPanel.active && this._dirty) {
                this._dirty = false;
                this.render();
            }
        });
    }

    private getOrUpdateById(id: String, collection: Map<String, WalkerByIdResult[]>, result: WalkerByIdResult) {
        const entry = collection.get(id);
        if (entry) {
            entry.push(result);
        } else {
            collection.set(id, [result]);
        }
    }

    initialize(): void {
        this.render();
        this._scanner.validatedResultsById$
            .pipe(takeUntil(this._onDestroy$))
            .subscribe(resultById => {
                this.errorResults.clear();
                this.warningResults.clear();
                this.successResults.clear();
                resultById.forEach((values, id) => {
                    values.forEach(value => {
                        const collection = value.state === 'success' ? this.successResults :
                            value.state === 'warning' ? this.warningResults : this.errorResults;
                        this.getOrUpdateById(id, collection, value);
                    });
                });
                this.render();
            });
    }

    private styles(): string {
        return `
        <style>
            span.link {
                transition: 150ms;
            }
            span.link:hover{
                cursor: pointer;
                color: var(--vscode-editorLink-activeForeground);
            }
            .error {
                color: var(--vscode-editorError-foreground);
            }
            .warning {
                color: var(--vscode-editorWarning-foreground);
            }
        </style>`;
    }

    private scripts(): string {
        return `
        <script>
            const vscode = acquireVsCodeApi();
            const callback = event => {
                const { url, id, occassion } = event.target.dataset;
                vscode.postMessage({
                    command: 'navigateToFile',
                    url,
                    id,
                    occassion
                });
            };
            document.querySelectorAll('span.link').forEach(linkTag => {
                linkTag.onclick = callback;
            });
        </script>`;
    }

    private render(): void {
        if (!this._panel.visible) {
            this._dirty = true;
            return;
        }
        this._panel.webview.html = `<!DOCTYPE html>
        <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>i18n Manager</title>
                ${this.styles()}
            </head>
            <body>
                ${(this.successResults.size + this.errorResults.size) > 0 ? this.renderBody() : this.renderLoading()}
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
            ${this.failedEntriesTable(this.errorResults, 'error')}
            ${this.failedEntriesTable(this.warningResults, 'warning')}

            <h2>These tags were found without error or warning</h2>
            <table border="1">
                <thead>
                    <tr>
                        <th>ID</th>
                        <th>Content</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(this.successResults.entries()).sort(([id1], [id2]) => id1.localeCompare(id2.toString())).map(([id, results]) => this.successTableRow(id, results)).join('')}
                </tbody>
            </table>
            ${this.scripts()}
        `;
    }
    private failedEntriesTable(entries: Map<String, WalkerByIdResult[]>, type: 'error' | 'warning'): string {
        if (entries.size === 0) {
            return '';
        }
        return `
        <h2>The following tags contained ${type}s</h2>
        <table border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Content</th>
                    <th>Error</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(entries.entries()).sort(([id1], [id2]) => id1.localeCompare(id2.toString())).map(([id, results]) => this.failedTableRow(id, results, type)).join('')}
            </tbody>
        </table>`;
    }

    private failedTableRow(id: String, results: WalkerByIdResult[], color: string) {
        const createHref = (result: WalkerByIdResult) => `<span class="link" data-id="${result.id}" data-url="${result.file}" data-occassion="${result.occassion}">${this.escapeHtml(result.value)}</span>`;
        return `
            <tr>
                <td>${id}</td>
                <td>
                    ${results.map(createHref).join('<br/>')}
                </td>
                <td class="${color}">
                    ${distinct(results.map(r => r.state !== 'success' && r.error)).join('<br/>')}
                </td>
            </tr>
        `;
    }

    private escapeHtml(str: string | false | undefined) {
        if (!str) {
            return '';
        }
        return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
    }

    private successTableRow(id: String, results: WalkerByIdResult[]) {
        const [first] = results;
        const result = first.value;
        return `
            <tr>
                <td>${id}</td>
                <td>
                    ${this.escapeHtml(result)}
                </td>
            </tr>
        `;
    }

    deactivate() {
        this._onDestroy$.next();
        this._onDestroy$.complete();
    }
}
