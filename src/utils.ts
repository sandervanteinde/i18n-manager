import { Uri, workspace, window, Selection, Position } from 'vscode';
import { WalkerByIdResult } from './workspace-scanner';

export function distinct<T>(arr: Array<T>): Array<T> {
    return [...new Set(arr)];
}

/**
 * @param file The file Uri
 * @param tag The tag to find
 * @param occasion The 0-indexed occasion within the file
 */
export function navigateToi18nTagInFile(file: Uri, tag: string, occasion: number = 0){
    workspace.openTextDocument(file).then(doc => {
        window.showTextDocument(doc).then(editor => {
            for(let i = 0; i < doc.lineCount; i++){
                const line = doc.lineAt(i);
                if(line.isEmptyOrWhitespace){
                    continue;
                }
                const tagIndex = line.text.indexOf(tag);
                if(tagIndex !== -1 && (occasion--) === 0){
                    editor.selection = new Selection(new Position(i, tagIndex), new Position(i, tagIndex + tag.length));
                    return;
                }
            }
        });
    });
}

export function escapeHtml(str: string | false | undefined) {
    if (!str) {
        return '<span class="not-found">No value found</span>';
    }
    return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
}

export function createUrl(result: WalkerByIdResult, valueSelector: (res: WalkerByIdResult) => string | undefined) {
    return `<span class="link copyable" data-id="${result.id}" data-url="${result.file}" data-occassion="${result.occassion}">${escapeHtml(valueSelector(result))}</span>`;
}
