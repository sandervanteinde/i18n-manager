import { WebviewPanel, Uri, workspace, window, env } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from './workspace-scanner';
import { first, takeUntil } from 'rxjs/operators';
import { Subject, combineLatest } from 'rxjs';
import { WalkerResult, Walker } from './walker';
import { distinct, navigateToi18nTagInFile, createUrl, escapeHtml } from './utils';

export class ManagerView {
    private _scanner = WorkspaceScanner.instance;
    private _onDestroy$ = new Subject<void>();
    private _dirty = false;

    errorResults = new Map<string, WalkerByIdResult[]>();
    warningResults = new Map<string, WalkerByIdResult[]>();
    successResults = new Map<string, WalkerByIdResult[]>();

    constructor(private _panel: WebviewPanel) {
        _panel.webview.options = {
            ..._panel.webview.options,
            enableScripts: true
        };
        _panel.webview.onDidReceiveMessage(message => {
            switch(message.command){
                case 'navigateToFile':
                    const uri = Uri.parse(message.url);
                    navigateToi18nTagInFile(uri, message.id, Number(message.occassion));
                    break;
                case 'copyToClipboard':
                    env.clipboard.writeText(message.id);
                    window.showInformationMessage(`Copied text '${message.id}' to the clipboard`);
                    break;
            }
            if (message.command === 'navigateToFile') {
            }
        });
        _panel.onDidChangeViewState(state => {
            if (state.webviewPanel.active && this._dirty) {
                this._dirty = false;
                this.render();
            }
        });
    }

    private getOrUpdateById(id: string, collection: Map<string, WalkerByIdResult[]>, result: WalkerByIdResult) {
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
            .link, .copyable {
                transition: 150ms;
            }

            .link:hover, .copyable:hover {
                cursor: pointer;
                color: var(--vscode-editorLink-activeForeground);
            }
            .error {
                color: var(--vscode-editorError-foreground);
            }
            .warning {
                color: var(--vscode-editorWarning-foreground);
            }
            .not-found {
                font-style: italic;
            }
        </style>`;
    }

    private scripts(): string {
        return `
        <script>
            const copyable = 'copyable';
            const link = 'link';
            const vscode = acquireVsCodeApi();
            const linkCallback = event => {
                for(let i = 0; i < event.path.length; i++){
                    const path = event.path[i];
                    if(path.classList.contains(link) && (!path.classList.contains(copyable) || !event.shiftKey)){
                        const { url, id, occassion } = path.dataset;
                        vscode.postMessage({
                            command: 'navigateToFile',
                            url,
                            id,
                            occassion
                        });
                        return;
                    }
                }
            };

            const copyableCallback = event => {
                if(!event.shiftKey) return;
                for(let i = 0; i < event.path.length; i++){
                    const path = event.path[i];
                    if(path.classList.contains('copyable')){
                        const { id } = path.dataset;
                        vscode.postMessage({
                            command: 'copyToClipboard',
                            id
                        });
                        return;
                    }
                }
            };

            document.querySelectorAll(\`.\${link}\`).forEach(linkTag => {
                linkTag.addEventListener('click', linkCallback);
            });

            document.querySelectorAll(\`.\${copyable}\`).forEach(clickTag => {
                clickTag.addEventListener('click', copyableCallback);
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
                        <th>In files</th>
                    </tr>
                </thead>
                <tbody>
                    ${Array.from(this.successResults.entries()).sort(([id1], [id2]) => id1.localeCompare(id2.toString())).map(([id, results]) => this.successTableRow(id, results)).join('')}
                </tbody>
            </table>
            ${this.scripts()}
        `;
    }
    private failedEntriesTable(entries: Map<string, WalkerByIdResult[]>, type: 'error' | 'warning'): string {
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



    private failedTableRow(id: string, results: WalkerByIdResult[], color: string) {
        return `
            <tr>
                <td><span class="copyable" data-id="${id}">${id}</span></td>
                <td>
                    ${results.map(res => createUrl(res, res => res.value)).join('<br/>')}
                </td>
                <td class="${color}">
                    ${distinct(results.map(r => r.state !== 'success' && r.message)).join('<br/>')}
                </td>
            </tr>
        `;
    }

    private getFileName(uri: Uri): string {
        const regex = /[^\\/]+\.[^\\/]+$/;
        const match = regex.exec(uri.toString());
        if (match) {
            return match[0];
        }
        return uri.toString();
    }

    private successTableRow(id: string, results: WalkerByIdResult[]) {
        const [first] = results;
        const result = first.value;
        return `
            <tr>
                <td><span class="copyable" data-id="${id}">${id}</span></td>
                <td>
                    ${escapeHtml(result)}
                </td>
                <td>
                    ${results.map(res => createUrl(res, res => this.getFileName(res.file))).join('<br/>')}
                </td>
            </tr>
        `;
    }

    deactivate() {
        this._onDestroy$.next();
        this._onDestroy$.complete();
    }
}
