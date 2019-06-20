// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { ExtensionContext, commands, window, ViewColumn, WebviewPanel } from 'vscode';
import { WorkspaceScanner } from './workspace-scanner';
import { ManagerView } from './manager-view';
let panel: WebviewPanel | undefined = undefined;
let wrapper: ManagerView | undefined = undefined;
// this method is called when your extension is activated
// your extension is activated the very first time the command is executed
export function activate(context: ExtensionContext) {

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = commands.registerCommand('extension.i18n-manager', () => {
		if (!WorkspaceScanner.instance.initialized) {
			WorkspaceScanner.instance.initialize();
		}
		if (panel) {
			panel.reveal(ViewColumn.Active);
		} else {
			panel = window.createWebviewPanel('i18nManager', 'i18n manager', ViewColumn.Active);
			wrapper = new ManagerView(panel);
			wrapper.initialize();
			panel.onDidDispose(e => {
				panel = undefined;
				if(wrapper){
					wrapper.deactivate();
				}
			});
		}
	});

	context.subscriptions.push(disposable);
}

// this method is called when your extension is deactivated
export function deactivate() {
	if(wrapper){
		wrapper.deactivate();
	}
 }
