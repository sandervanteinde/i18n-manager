import { TreeDataProvider, TreeItem, EventEmitter, TreeItemCollapsibleState, ProviderResult, Disposable, window, Uri } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from '../workspace-scanner';
import { map, first } from 'rxjs/operators';

export interface I18nItem {
  readonly type: 'i18n';
  readonly id: string;
  readonly entries: WalkerByIdResult[];
}

interface LabelItem {
  readonly type: 'label';
  readonly label: string;
}

export interface I18nValue {
  readonly type: 'i18n-value';
  readonly value?: string;
  readonly id: string;
  readonly file: Uri;
  readonly occasion?: number;
}

interface GroupingItem {
  readonly type: 'grouping';
  readonly group: 'Errors' | 'Warnings' | 'all';
  readonly entries: ReadonlyMap<string, WalkerByIdResult[]>;
  readonly isVisibleInTree: boolean;
}

type AllTreeItems = I18nItem | LabelItem | GroupingItem | I18nValue;


class I18nTreeTag extends TreeItem {
  readonly #count: number;
  constructor(readonly id: string, count: number) {
    super(id, TreeItemCollapsibleState.Collapsed);
    this.#count = count;
    this.contextValue = 'tag';
  }

  get description(): string {
    return `${this.#count} time${this.#count > 1 ? 's' : ''} used`;
  }
}

class I18nTreeValue extends TreeItem {
  constructor(readonly i18nValue: I18nValue) {
    super(I18nTreeValue.fileName(i18nValue.file), TreeItemCollapsibleState.None);
    this.contextValue = 'value';
  }

  get description(): string {
    return this.i18nValue.value ?? 'No value';
  }

  private static fileName(file: Uri): string {
    const segments = file.path.split('/');
    return segments[segments.length - 1];
  }
}

export class I18nDataProvider implements TreeDataProvider<AllTreeItems> {
  #onDidChangeTreeData = new EventEmitter<void | AllTreeItems | undefined | null>();
  readonly onDidChangeTreeData = this.#onDidChangeTreeData.event;
  get scanner() { return WorkspaceScanner.instance; }

  getTreeItem(element: AllTreeItems): TreeItem | Thenable<TreeItem> {
    switch (element.type) {
      case 'grouping':
        return new TreeItem(element.group, element.isVisibleInTree ? TreeItemCollapsibleState.Expanded : TreeItemCollapsibleState.Collapsed);
      case 'label':
        return new TreeItem(element.label, TreeItemCollapsibleState.None);
      case 'i18n':
        return new I18nTreeTag(element.id, element.entries.length);
      case 'i18n-value':
        return new I18nTreeValue(element);
      default:
        const _: never = element;
        throw new Error('Unreachable case');
    }
  }

  getChildren(element?: AllTreeItems): ProviderResult<AllTreeItems[]> {
    if (!element) {
      return this.createGroupingResult();
    }
    switch (element.type) {
      case 'grouping':
        return this.providerResultForGrouping(element);
      case 'i18n':
        return this.createI18nChildren(element);
      case 'label':
      case 'i18n-value':
        return [];
      default:
        const _: never = element;
        throw new Error('Unreachable case');
    }
  }

  listenForUpdates(): Disposable {
    const unsubscribe = this.scanner.resultsById$.subscribe(() => this.#onDidChangeTreeData.fire(undefined));
    return Disposable.from({ dispose: () => unsubscribe.unsubscribe() });
  }

  doSomething() {
    window.showErrorMessage('Hello error');
  }

  private createI18nChildren(item: I18nItem): ProviderResult<AllTreeItems[]> {
    return [
      ...item.entries.map(entry => ({ type: 'i18n-value', id: item.id, file: entry.file, value: entry.value, occasion: entry.occassion } as I18nValue))
    ];
  }

  private createGroupingResult(): ProviderResult<GroupingItem[]> {
    return this.scanner.validatedResultsById$.pipe(
      map(entries => {
        const errors = new Map<string, WalkerByIdResult[]>();
        const warnings = new Map<string, WalkerByIdResult[]>();
        const result: Array<GroupingItem> = [];
        for (let [key, values] of entries) {
          let hasError = false;
          let hasWarning = false;
          for (let value of values) {
            if (hasError && hasWarning) { break; }
            hasError = hasError || value.state === 'error';
            hasWarning = hasWarning || value.state === 'warning';
          }
          if (hasError) {
            errors.set(key, values);
          }
          if (hasWarning) {
            warnings.set(key, values);
          }
        }

        if (errors.size > 0) {
          result.push({ entries: errors, group: 'Errors', type: 'grouping', isVisibleInTree: true });
        }

        if (warnings.size > 0) {
          result.push({ entries: warnings, group: 'Warnings', type: 'grouping', isVisibleInTree: true });
        }

        result.push({ entries, group: 'all', type: 'grouping', isVisibleInTree: result.length === 0 });

        return result;
      }),
      first()
    ).toPromise();
  }

  private providerResultForGrouping(item: GroupingItem): ProviderResult<I18nItem[]> {
    const treeItems: Array<I18nItem> = [];
    item.entries.forEach((value, key) => {
      treeItems.push({ id: key, type: 'i18n', entries: value });
    });
    return treeItems;
  }

}
