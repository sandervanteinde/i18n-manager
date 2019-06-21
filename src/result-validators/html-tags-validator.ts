import { EntryResultValidator } from './result-validator';
import { WarningType } from '../warning-type';
import { WalkerByIdResult } from '../workspace-scanner';

export class HtmlTagsValidator implements EntryResultValidator {
    validate(entry: WalkerByIdResult): WalkerByIdResult {
        if (entry.value && entry.value.indexOf('<') >= 0) {
            return { ...entry, state: 'warning', warning: WarningType.HasHtmlTags, message: 'This translation contains HTML tag. This is not recommended!' };
        }
        return entry;
    }
}
