import { env, window } from 'vscode';

export const Clipboard = {
  setText(text: string): void {
    env.clipboard.writeText(text).then(() => {
      window.showInformationMessage(`Copied '${text}' to the clipboard`);
    }, err => window.showErrorMessage(`Copy failed: ${err}`));
  }
} as const;
