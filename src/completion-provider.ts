import { ExtensionContext, languages, CompletionItem, ProviderResult, CompletionList, TextDocument, Position, workspace, window, MarkdownString, TextEdit, Range } from "vscode";
import { Configuration } from "./configuration";
import { combineLatest, ReplaySubject, BehaviorSubject, timer } from "rxjs";
import { WorkspaceScanner, WalkerByIdResult } from "./workspace-scanner";
import { filter, map, distinctUntilChanged, first, race } from "rxjs/operators";
import { Token, ParseTreeResult, Attribute, Element, AotCompiler, ParseLocation } from "@angular/compiler";
import { toTokens, findNodeAtLocation, isPositionInNode, isPositionBetweenSpans } from "./utils";
import { stringify } from "@angular/compiler/src/util";

export class CompletionProvider {
    private _dispose: (() => void) | undefined;
    private _tokenedOpenDocument: ParseTreeResult | undefined = undefined;
    private constructor(private _context: ExtensionContext) {
        const subscription = Configuration.instance.languageConfiguration$.pipe(
            map(x => x.i18nHtmlAutoCompletion),
            distinctUntilChanged()
        ).subscribe(enabled => {
            if (enabled) {
                this.start();
            } else {
                this.stop();
            }
        });

        _context.subscriptions.push({
            dispose: () => {
                subscription.unsubscribe();
                if (this._dispose) {
                    this._dispose();
                }
            }
        });
    }
    private static _instance: CompletionProvider | undefined;
    static get instance(): CompletionProvider {
        if (CompletionProvider._instance) {
            return CompletionProvider._instance;
        }
        throw new Error('initialize was not invoked');
    }
    static initialize(context: ExtensionContext) {
        if (CompletionProvider._instance) {
            return;
        }
        this._instance = new CompletionProvider(context);
        context.subscriptions.push({ dispose: () => CompletionProvider._instance = undefined });
    }

    private tokenizeDocument(document: TextDocument) {
        this._tokenedOpenDocument = toTokens(document);
    }

    private createCompletionItem({ element, attribute }: { element: Element, attribute: Attribute }, id: string, results: WalkerByIdResult[], searchString: string): CompletionItem {
        const edits: TextEdit[] = [];
        const value = results.length > 0 && results[0].value;
        if (value) {
            if (attribute.name === 'i18n') {
                if (element.children.length > 0) {
                    const start = element.children[0].sourceSpan.start;
                    const end = element.children[element.children.length - 1].sourceSpan.end;
                    const range = new Range(start.line, start.col, end.line, end.col);
                    edits.push(TextEdit.replace(range, value));
                } else {
                    edits.push(TextEdit.insert(new Position(element.sourceSpan.end.line, element.sourceSpan.end.col), value));
                }
            } else {
                const i18nAttributeName = attribute.name.substr(5);
                const matchingAttribute = element.attrs.find(attr => attr.name === i18nAttributeName);
                if (!matchingAttribute) {
                    edits.push(TextEdit.insert(new Position(element.sourceSpan.end.line, element.sourceSpan.end.col - 1), ` ${i18nAttributeName}="${value}"`));
                } else {
                    const span = matchingAttribute.valueSpan;
                    if (span) {
                        const range = new Range(span.start.line, span.start.col, span.end.line, span.end.col);
                        edits.push(TextEdit.replace(range, value));
                    }
                }
            }
        }
        return {
            label: id,
            insertText: searchString.startsWith('@@') && id.substr(2) || id,
            documentation: new MarkdownString(`Sets this i18n attribute and its value to id: **${id}** value: **${results[0].value}**`),
            additionalTextEdits: edits
        };
    }

    private start() {
        const codeCompletionProvider = languages.registerCompletionItemProvider('html', {
            provideCompletionItems: (document, position) => {
                console.log(...arguments);
                return new Promise((res, err) => {
                    try {
                        this.tokenizeDocument(document);
                        const result = this.isInI18nTag(position);
                        if (!result) {
                            err();
                            return;
                        }
                        timer(1000).pipe(
                            map(() => new Map()),
                            race(WorkspaceScanner.instance.resultsById$),
                            first()
                        ).subscribe(map => {
                            const currentAttrVal = result.attribute.value;
                            const completionItems: CompletionItem[] = [];
                            map.forEach((val, id) => {
                                if (id !== currentAttrVal && id.startsWith(currentAttrVal)) {
                                    completionItems.push(this.createCompletionItem(result, id, val, currentAttrVal));
                                }
                            });
                            res({
                                isIncomplete: false,
                                items: completionItems
                            });
                        });
                    } catch (error) {
                        err(error);
                    }
                });
            }
        });
        this._dispose = () => {
            codeCompletionProvider.dispose();
        };

        console.log('[i18n-manager] completion provider started');
    }

    private stop() {
        if (this._dispose) {
            this._dispose();
        }
        console.log('[i18n-manager] completion provider stopped');
    }

    private isInI18nTag(position: Position): { element: Element, attribute: Attribute } | false {
        if (!this._tokenedOpenDocument) {
            return false;
        }

        const element = findNodeAtLocation(this._tokenedOpenDocument, position);

        if (!(element instanceof Element) || element.attrs.length === 0) {
            return false;
        }

        for (const attribute of element.attrs) {
            const { valueSpan } = attribute;
            if (!valueSpan) {
                continue;
            }
            if (isPositionBetweenSpans(position, valueSpan.start, valueSpan.end)) {
                return {
                    element,
                    attribute
                }
            }
        }
        return false;
    }
}