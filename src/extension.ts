// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, commands, window, ViewColumn, WebviewPanel } from 'vscode';
import { WorkspaceScanner } from './workspace-scanner';
import { ManagerView } from './manager-view';
import { GlobalNotifications } from './global-notifications';
import { Configuration } from './configuration';
import { CompletionProvider } from './completion-provider';
import { searchQuickPick } from './quick-picks/search-quick-pick';
import { I18nDataProvider } from './view/i18n-data-provider';

let panel: WebviewPanel | undefined = undefined;
let wrapper: ManagerView | undefined = undefined;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const i18nCommand = commands.registerCommand('extension.i18n-manager', () => {
        if (panel) {
            panel.reveal(ViewColumn.Active);
        } else {
            panel = window.createWebviewPanel('i18nManager', 'i18n manager', ViewColumn.Active);
            wrapper = new ManagerView(panel);
            wrapper.initialize();
            panel.onDidDispose(e => {
                panel = undefined;
                if (wrapper) {
                    wrapper.deactivate();
                }
            });
        }
    });

    const i18nSearchCommand = commands.registerCommand('extension.i18n-manager-search', () => {
        searchQuickPick();
    });

    Configuration.initialize(context);

    WorkspaceScanner.instance.initialize(context);

    
    GlobalNotifications.activate(context);
    
    CompletionProvider.initialize(context);
    
    const treeProvider = new I18nDataProvider();
    const treeDataProvider = window.registerTreeDataProvider('i18n-manager-view', treeProvider);
    window.createTreeView('i18n-manager-view', { treeDataProvider: treeProvider});
    const treeProviderListener = treeProvider.listenForUpdates();    
    context.subscriptions.push(i18nCommand, i18nSearchCommand, treeDataProvider, treeProviderListener);
    console.log('[i18n-manager] Started extension');
}

// this method is called when your extension is deactivated
export function deactivate() {
    if (panel) {
        panel.dispose();
    }
    WorkspaceScanner.deactivate();
}
