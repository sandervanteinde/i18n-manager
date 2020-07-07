import { TreeDataProvider, TreeItem, EventEmitter, TreeItemCollapsibleState, ProviderResult, Disposable, commands } from 'vscode';
import { WorkspaceScanner, WalkerByIdResult } from '../workspace-scanner';
import { map, first, window } from 'rxjs/operators';
import { allowedNodeEnvironmentFlags } from 'process';

interface I18nItem {
  readonly type: 'i18n';
  readonly id: string;
  readonly entries: WalkerByIdResult[];
}

interface LabelItem {
  readonly type: 'label';
  readonly label: string;
}

interface GroupingItem {
  readonly type: 'grouping';
  readonly group: 'Errors' | 'Warnings' | 'all';
  readonly entries: ReadonlyMap<string, WalkerByIdResult[]>;
}

interface CopyValueItem {
  readonly type: 'copy';
  readonly text: string;
  readonly copyText: string;
}

type AllTreeItems = I18nItem | LabelItem | GroupingItem | CopyValueItem;


export class I18nTreeItem extends TreeItem {
  constructor(id: string, private readonly _count: number) { 
    super(id, TreeItemCollapsibleState.Collapsed);
  }

  get description(): string { 
    return `${this._count} time${this._count > 1 ? 's' : ''} used`;
  }
}

export class I18nDataProvider implements TreeDataProvider<AllTreeItems> {
  private readonly _onDidChangeTreeData = new EventEmitter<void | AllTreeItems | undefined | null>();
  readonly onDidChangeTreeData = this._onDidChangeTreeData.event;
  get scanner() { return WorkspaceScanner.instance; }

  getTreeItem(element: AllTreeItems): TreeItem | Thenable<TreeItem> {
    switch (element.type) {
      case 'grouping':
        return new TreeItem(element.group, TreeItemCollapsibleState.Expanded);
      case 'label':
        return new TreeItem(element.label, TreeItemCollapsibleState.None);
      case 'i18n':
        return new I18nTreeItem(element.id, element.entries.length);
      case 'copy':
        const item = new TreeItem(element.text);
        return item;
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
      case 'copy':
        return [];
      default:
        const _: never = element;
        throw new Error('Unreachable case');
    }
  }

  listenForUpdates(): Disposable {
    const unsubscribe = this.scanner.resultsById$.subscribe(() => this._onDidChangeTreeData.fire(undefined));
    return Disposable.from({ dispose: () => unsubscribe.unsubscribe() });
  }

  private createI18nChildren(item: I18nItem): ProviderResult<AllTreeItems[]> {
    return [
      { type: 'copy', text: 'Copy i18n tag', copyText: item.id },
      ...item.entries.map(entry => ({type: 'copy', text: `Copy value ${entry.value}`, copyText: entry.value as string} as CopyValueItem))
    ];
  }

  private createGroupingResult(): ProviderResult<GroupingItem[]> {
    return this.scanner.validatedResultsById$.pipe(
      map(entries => {
        const errors = new Map<string, WalkerByIdResult[]>();
        const warnings = new Map<string, WalkerByIdResult[]>();
        for(let [key, values] of entries) {
          let hasError = false;
          let hasWarning = false;
          for (let value of values) {
            if(hasError && hasWarning) { break; } 
            hasError = hasError || value.state === 'error';
            hasWarning = hasWarning || value.state === 'warning';
          }
          if(hasError) {
            errors.set(key, values);
          }
          if (hasWarning){
            warnings.set(key, values);
          }

          const result: Array<GroupingItem> = [];
          if(errors.size > 0 ){
            result.push({ entries: errors, group: 'Errors', type: 'grouping'});
          }
          if(warnings.size > 0) {
            result.push({ entries: warnings, group: 'Warnings', type: 'grouping'});
          }
          result.push({entries, group: 'all', type: 'grouping'});
          return result;
        }
      }),
      first()
    ).toPromise();
  }

  private providerResultForGrouping(item: GroupingItem): ProviderResult<I18nItem[]> {
    const treeItems: Array<I18nItem> = [];
    item.entries.forEach((value, key) => {
      treeItems.push({id: key, type: 'i18n', entries: value});
    });
    return treeItems;
  }

}
