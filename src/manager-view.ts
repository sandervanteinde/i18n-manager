import { WebviewPanel, Uri, window, env } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from './workspace-scanner';
import { takeUntil, withLatestFrom, map } from 'rxjs/operators';
import { Subject } from 'rxjs';
import { navigateToi18nTagInFile, createUrl, navigateToi18nContentsInFile } from './utils';

export class ManagerView {
    private _scanner = WorkspaceScanner.instance;
    private _onDestroy$ = new Subject<void>();
    private _dirty = false;

    private _fixButtonPressed$ = new Subject<{ id: string, buttonId: string, index: number }>();

    errorResults = new Map<string, WalkerByIdResult[]>();
    warningResults = new Map<string, WalkerByIdResult[]>();
    successResults = new Map<string, WalkerByIdResult[]>();

    constructor(private _panel: WebviewPanel) {
        _panel.webview.options = {
            ..._panel.webview.options,
            enableScripts: true
        };
        _panel.webview.onDidReceiveMessage(message => {
            let uri: Uri;
            switch (message.command) {
                case 'navigateToId':
                    uri = Uri.parse(message.url);
                    navigateToi18nTagInFile(uri, message.id, Number(message.occassion));
                    break;
                case 'navigateToContent':
                    uri = Uri.parse(message.url);
                    navigateToi18nContentsInFile(uri, message.id, Number(message.occassion));
                    break;
                case 'copyToClipboard':
                    env.clipboard.writeText(message.text);
                    window.showInformationMessage(`Copied text '${message.text}' to the clipboard`);
                    break;
                case 'fix':
                    this._fixButtonPressed$.next({ id: message.id, buttonId: message.buttonId, index: message.index });
                    break;
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
        this._fixButtonPressed$.pipe(
            withLatestFrom(this._scanner.validatedResultsById$),
            map(([buttonData, validationResult]) => ({ ...buttonData, validationResult }))
        ).subscribe(data => {
            const results = data.validationResult.get(data.id);
            if (!results || results.length < data.index) {
                return;
            }

            const { fixer } = results[data.index];
            if (fixer) {
                fixer.startFix(data.buttonId);
            }
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

            button {    
                background-color: var(--vscode-button-background);
                box-shadow: none;
                color: var(--vscode-button-foreground);
                -webkit-appearance: button-bevel;
                transition: 100ms;
                cursor: pointer;
                margin: 0 10px;
            }

            button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }

            .button-container {
                display: flex;
                flex-wrap: wrap;
            }
        </style>`;
    }

    private scripts(): string {
        return `
        <script>
            const copyable = 'copyable';
            const link = 'link';
            const fixButton = 'fix-button';
            debugger;

            const vscode = acquireVsCodeApi();
            const findEventElement = (event, clss) => {
                for(let i = 0; i < event.path.length; i++){
                    const path = event.path[i];
                    if(path.classList.contains(clss)){
                        return path;
                    }
                }
            };
            const linkCallback = event => {
                const element = findEventElement(event, link);
                if(!element.classList.contains(copyable) || !event.shiftKey){
                    const { to } = element.dataset;
                    vscode.postMessage({
                        command: to === 'content' ? 'navigateToContent' : 'navigateToId',
                        ...element.dataset
                    });
                }
            };

            const copyableCallback = event => {
                if(!event.shiftKey) return;
                const element = findEventElement(event, copyable);
                vscode.postMessage({
                    command: 'copyToClipboard',
                    text: element.innerHTML
                });
                return;
            };

            const fixButtonCallback = event => {
                const fixbutton = findEventElement(event, fixButton);
                vscode.postMessage({
                    command: 'fix',
                    ...fixbutton.dataset
                });
            }

            document.querySelectorAll(\`.\${link}\`).forEach(linkTag => linkTag.addEventListener('click', linkCallback));
            document.querySelectorAll(\`.\${copyable}\`).forEach(clickTag => clickTag.addEventListener('click', copyableCallback));
            document.querySelectorAll(\`.\${fixButton}\`).forEach(fixButton => fixButton.addEventListener('click', fixButtonCallback));
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
                ${WorkspaceScanner.instance.initialized ? this.renderBody() : this.renderLoading()}
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
            ${this.renderSuccessTable()}
            ${this.scripts()}
        `;
    }

    private renderSuccessTable(): string {
        if (this.successResults.size === 0) {
            return '';
        }
        return `
        <h2>These tags were found without error or warning</h2>
        <table border="1">
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Content</th>
                    <th>File name</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(this.successResults.entries()).sort(([id1], [id2]) => id1.localeCompare(id2.toString())).map(([id, results]) => this.successTableRow(results)).join('')}
            </tbody>
        </table>`;
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
                    <th>Fixers</th>
                </tr>
            </thead>
            <tbody>
                ${Array.from(entries.entries()).sort(([id1], [id2]) => id1.localeCompare(id2.toString())).map(([id, results]) => this.failedTableRow(results, type)).join('')}
            </tbody>
        </table>`;
    }

    private renderFixerButtons(res: WalkerByIdResult, index: number): string {
        const { fixer } = res;
        if (!fixer) {
            return 'No fixer available';
        }
        const buttons = fixer.getFixButtons();

        return buttons.map(button => `<button class="fix-button" data-id="${res.id}" data-index="${index}" data-button-id="${button.id}">${button.label}</button>`).join('');
    }

    private failedTableRow(results: WalkerByIdResult[], color: string) {
        return results.map((res, index) => `
            <tr>
                <td>${
            res.id ? createUrl(res, res => res.id, 'id') :
                '<span class="not-found">No value found</span>'
            }</td>
                <td>
                    ${createUrl(res, res => res.value, 'content')}
                </td>
                <td class="${color}">
                    ${res.state !== 'success' && res.message}
                </td>
                <td>
                    <div class="button-container">
                        ${this.renderFixerButtons(res, index)}
                    </div>
                </td>
            </tr>
        `).join('');
    }

    private getFileName(uri: Uri): string {
        const regex = /[^\\/]+\.[^\\/]+$/;
        const match = regex.exec(uri.toString());
        if (match) {
            return match[0];
        }
        return uri.toString();
    }

    private successTableRow(results: WalkerByIdResult[]) {
        return results.map(res => `
            <tr>
                <td>${
            res.id ? createUrl(res, res => res.id, 'id') :
                '<span class="not-found">No value found</span>'
            }</td>
                <td>
                    ${createUrl(res, res => res.value, 'content')}
                </td>
                <td>
                    ${this.getFileName(res.file)}
                </td>
            </tr>
        `).join('');
    }

    deactivate() {
        this._onDestroy$.next();
        this._onDestroy$.complete();
    }
}
