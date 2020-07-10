import { QuickPickItem, window } from 'vscode';
import { WalkerByIdResult, WorkspaceScanner } from '../workspace-scanner';
import { first, map } from 'rxjs/operators';
import { navigateToi18nTagInFile } from '../utils';
import { Clipboard } from '../utils/clipboard';

export type SearchQuickPickItems = QuickPickItem & {
  key: string;
  item: WalkerByIdResult[];
};
export function searchQuickPick() {
  window.showQuickPick(WorkspaceScanner.instance.resultsById$.pipe(
    first(),
    map(result => {
      const items: SearchQuickPickItems[] = [];
      result.forEach((value, key) => {
        items.push({
          label: `[${key}]: ${value[0].value}`,
          key,
          item: value
        });
      });
      return items;
    })
  ).toPromise()).then(selectedItem => {
    if(selectedItem) { performSearchOperation(selectedItem); }
  });
}

type SearchOperationItem = QuickPickItem & {
  performOp: () => void;
};



export function performSearchOperation(item: SearchQuickPickItems) {
  const uniqueValues : Set<string> = new Set(item.item.filter(result => result.value).map(result => result.value as string));
  const items: Array<SearchOperationItem> = [
    { label: `Copy id: ${item.key}`, performOp: () => Clipboard.setText(item.key) }
  ];

  uniqueValues.forEach((value, _, set) => {
    if(set.size === 1) {
      items.push({ label: `Copy value: ${value}`, performOp: () => Clipboard.setText(value)});
    } else {
      items.push({ label: `Copy value 1: ${value}`, performOp: () => Clipboard.setText(value)});
    }
  });

  item.item.forEach(value => {
    items.push({ label: `Navigate to usage in ${value.file.path}`, performOp: () => navigateToi18nTagInFile(value.file, item.key, value.occassion) } );
  });

  window.showQuickPick(items).then(item => item?.performOp());
}
