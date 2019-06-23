import { Uri, workspace, window, Selection, Position, Range, TextEditorRevealType, TextDocument, TextEditor, DocumentHighlight } from 'vscode';
import { WalkerByIdResult } from './workspace-scanner';
import { HtmlParser, ParseTreeResult, Node, Element, ParseSourceSpan } from '@angular/compiler';

export const i18nMatchPattern = /i18n(?:-([^=]+))?/;
export function distinct<T>(arr: Array<T>): Array<T> {
    return [...new Set(arr)];
}

export function toTokens(doc: TextDocument): ParseTreeResult {
    const parser = new HtmlParser();
    const result = parser.parse(doc.getText(), doc.uri.toString());
    return result;
}

function* iterateNode(node: Node): Iterable<Node> {
    yield node;
    if (node instanceof Element) {
        for (var child of node.children) {
            for (var childNode of iterateNode(child)) {
                yield childNode;
            }
        }
    }
}

export function* iterateTreeResult(result: ParseTreeResult): Iterable<Node> {
    for (var node of result.rootNodes) {
        for (var childNode of iterateNode(node)) {
            yield childNode;
        }
    }
}

function toPosition(startSpan?: ParseSourceSpan, endSpan: ParseSourceSpan | undefined = startSpan) {
    return startSpan && endSpan && {
        start: new Position(startSpan.start.line, startSpan.start.col),
        end: new Position(endSpan.end.line, endSpan.end.col)
    };
}

export function getPositionOfi18nTag(doc: ParseTreeResult, id: string, occassion: number): { start: Position, end: Position } | undefined {
    for (var node of iterateTreeResult(doc)) {
        if (node instanceof Element) {
            const attr = node.attrs.find(at => at.name.startsWith('i18n') && at.value === id);
            if (attr && (occassion-- === 0)) {
                return toPosition(attr.valueSpan);
            }
        }
    }
}

export function getPositionOfi18nTagContent(doc: ParseTreeResult, id: string, occassion: number): { start: Position, end: Position } | undefined {
    for (var node of iterateTreeResult(doc)) {
        if (node instanceof Element) {
            const attr = node.attrs.find(at => at.name.startsWith('i18n') && at.value === id);
            if (attr && (occassion-- === 0)) {
                const match = i18nMatchPattern.exec(attr.name);
                if (match) { // attribute
                    if (match[1]) {
                        const i18nMatchingAttribute = node.attrs.find(attr => attr.name === match[1]);
                        if (i18nMatchingAttribute) {
                            return toPosition(i18nMatchingAttribute.valueSpan);
                        }
                    } else {
                        const firstChild = node.children[0];
                        const lastChild = node.children[node.children.length - 1];
                        return toPosition(firstChild.sourceSpan, lastChild.sourceSpan);
                    }
                } else {
                    return undefined;
                }
            }
        }
    }
}

export function navigateToPosition(editor: TextEditor, position?: { start: Position, end: Position }): void {
    if (position) {
        editor.selection = new Selection(position.start, position.end);
        editor.revealRange(new Range(position.start, position.end), TextEditorRevealType.InCenterIfOutsideViewport);
    }
}

/**
 * @param file The file Uri
 * @param id The tag to find
 * @param occasion The 0-indexed occasion within the file
 */
export function navigateToi18nTagInFile(file: Uri, id: string, occasion: number = 0) {
    workspace.openTextDocument(file).then(doc => {
        window.showTextDocument(doc).then(editor => navigateToPosition(editor, getPositionOfi18nTag(toTokens(doc), id, occasion)));
    });
}

/**
 * @param file The file Uri
 * @param id The tag to find
 * @param occasion The 0-indexed occasion within the file
 */
export function navigateToi18nContentsInFile(file: Uri, id: string, occasion: number = 0) {
    workspace.openTextDocument(file).then(doc => {
        window.showTextDocument(doc).then(editor => navigateToPosition(editor, getPositionOfi18nTagContent(toTokens(doc), id, occasion)));
    });
}

export function geti18nAttribute(line: string): string | undefined {
    const result = i18nMatchPattern.exec(line);
    if (result) {
        return result[1];
    }
    return undefined;
}

function doReplaceByPosition(file: Uri, id: string, value: string, callback: (doc: ParseTreeResult, id: string, occassion: number) => ({ start: Position, end: Position } | undefined)) {
    workspace.openTextDocument(file).then(doc => {
        const content = toTokens(doc);
        const positions: { start: Position, end: Position }[] = [];
        for (let i = 0; true; i++) {
            const position = callback(content, id, i);
            if (!position) {
                break;
            }
            positions.push(position);
        }
        if (positions.length > 0) {
            window.showTextDocument(doc, { preview: false, preserveFocus: true }).then(editor => {
                editor.edit(edit => {
                    positions.forEach(position => edit.replace(new Range(position.start, position.end), value));
                });
            });
        }
    });
}

export function replaceI18nValuesById(file: Uri, id: string, value: string) {
    doReplaceByPosition(file, id, value, (content, id, occassion) => getPositionOfi18nTagContent(content, id, occassion));
}

export function replaceI18nIdsById(file: Uri, id: string, value: string) {
    doReplaceByPosition(file, id, value, (content, id, occassion) => getPositionOfi18nTag(content, id, occassion));
}

export function escapeHtml(str: string | false | undefined) {
    if (!str) {
        return '<span class="not-found">No value found</span>';
    }
    return str.replace(/</gi, '&lt;').replace(/>/gi, '&gt;');
}

export function createUrl(result: WalkerByIdResult, valueSelector: (res: WalkerByIdResult) => string | undefined, to: 'id' | 'content' = 'id') {
    return `<span class="link copyable" data-id="${result.id}" data-url="${result.file}" data-to="${to}" data-occassion="${result.occassion}">${escapeHtml(valueSelector(result))}</span>`;
}

export function nameOf<T>(name: keyof T): keyof T;
export function nameOf<T>(...name: (keyof T)[]): (keyof T)[];
export function nameOf<T>(...name: (keyof T)[]): keyof T | (keyof T)[] {
    if (name.length === 0) {
        return [];
    } else if (name.length === 1) {
        return name[0];
    } else {
        return name;
    }
}

export function objectHasFunctions<T extends object>(object: T, ...names: (keyof T)[]): boolean {
    for (let name of names) {
        if (!object.hasOwnProperty(name)) {
            return false;
        }
        if (typeof object[name] !== 'function') {
            return false;
        }
    }
    return true;
}