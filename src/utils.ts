import { Uri, workspace, window, Selection, Position } from 'vscode';

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
