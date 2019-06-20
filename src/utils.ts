import { Uri, workspace, window, Selection, Position } from 'vscode';

export function distinct<T>(arr: Array<T>): Array<T> {
    return [...new Set(arr)];
}

export function navigateToi18nTagInFile(file: Uri, tag: string){
    workspace.openTextDocument(file).then(doc => {
        window.showTextDocument(doc).then(editor => {
            for(let i = 0; i < doc.lineCount; i++){
                const line = doc.lineAt(i);
                if(line.isEmptyOrWhitespace){
                    continue;
                }
                const tagIndex = line.text.indexOf(tag);
                if(tagIndex !== -1){
                    editor.selection = new Selection(new Position(i, tagIndex), new Position(i, tagIndex + tag.length));
                    return;
                }
            }
        });
    });
}
