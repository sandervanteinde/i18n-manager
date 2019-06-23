import { nameOf, objectHasFunctions } from "../utils";

export interface FixableButton {
    id: string;
    label: string;
}

export interface Fixable {
    getFixButtons(): Array<FixableButton>;
    startFix(buttonId: string): void;
}
