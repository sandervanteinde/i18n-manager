import { ReplaySubject } from "rxjs";
import { workspace, ExtensionContext, ConfigurationChangeEvent } from "vscode";

export type ValidatorLevel = 'warning' | 'error';
export interface ValidatorConfiguration {
    idMustMatchRegex: Readonly<{
        enabled: boolean,
        level: ValidatorLevel,
        pattern: string
    }>;
    duplicateValues: Readonly<{
        enabled: boolean,
        level: ValidatorLevel
    }>;
    warnForHtmlTags: Readonly<{
        enabled: boolean,
        level: ValidatorLevel
    }>;
    mismatchingValues: Readonly<{
        enabled: boolean,
        level: ValidatorLevel
    }>;
    warnForInterpolations: Readonly<{
        enabled: boolean,
        level: ValidatorLevel
    }>;
}

export interface NotificationConfiguration {
    showNotifications: boolean;
    minimumLevel: ValidatorLevel;
}

export class Configuration {
    static get instance(): Configuration {
        if (!this._instance) {
            throw new Error('initialize was not invoked');
        }
        return this._instance;
    }
    private static _instance: Configuration | undefined;
    static initialize(context: ExtensionContext) {
        this._instance = new Configuration(context);
    }

    private _validatorConfiguration$ = new ReplaySubject<Readonly<ValidatorConfiguration>>(1);
    validatorConfiguration$ = this._validatorConfiguration$.asObservable();

    private _notificationsConfiguration$ = new ReplaySubject<Readonly<NotificationConfiguration>>(1);
    notificationsConfiguration$ = this._notificationsConfiguration$.asObservable();

    constructor(context: ExtensionContext) {
        const disposable = workspace.onDidChangeConfiguration(ev => this.onConfigurationChanged(ev));
        context.subscriptions.push(disposable);

        this.pushNewValidatorsConfiguration();
        this.pushNewNotificationsConfiguration();
    }

    private onConfigurationChanged(event: ConfigurationChangeEvent): void {
        if (event.affectsConfiguration('sandervanteinde.i18n-manager.validators')) {
            this.pushNewValidatorsConfiguration();
        }
        if (event.affectsConfiguration('sandervanteinde.i18n-manager.notifications')) {
            this.pushNewNotificationsConfiguration();
        }
    }

    private pushNewValidatorsConfiguration(): void {
        const config = workspace.getConfiguration('sandervanteinde.i18n-manager.validators');
        const validators: ValidatorConfiguration = {
            duplicateValues: {
                enabled: config.get<boolean>('duplicateValues.enabled', true),
                level: config.get<ValidatorLevel>('duplicateValues.level', 'warning')
            },
            idMustMatchRegex: {
                enabled: config.get<boolean>('idMustMatchRegex.enabled', false),
                level: config.get<ValidatorLevel>('idMustMatchRegex.level', 'warning'),
                pattern: config.get<string>('idMustMatchRegex.pattern', '^.+$')
            },
            mismatchingValues: {
                enabled: config.get<boolean>('mismatchingValues.enabled', true),
                level: config.get<ValidatorLevel>('mismatchingValues.level', 'error')
            },
            warnForHtmlTags: {
                enabled: config.get<boolean>('mismatchingValues.enabled', true),
                level: config.get<ValidatorLevel>('mismatchingValues.level', 'warning')
            },
            warnForInterpolations: {
                enabled: config.get<boolean>('warnForInterpolations.enabled', false),
                level: config.get<ValidatorLevel>('warnForInterpolations.level', 'warning')
            }
        };
        this._validatorConfiguration$.next(validators);
    }

    private pushNewNotificationsConfiguration(): void {
        const config = workspace.getConfiguration('sandervanteinde.i18n-manager.notifications');

        const notifications: NotificationConfiguration = {
            showNotifications: config.get<boolean>('enabled', true),
            minimumLevel: config.get<ValidatorLevel>('minimumLevel', 'warning')
        };

        this._notificationsConfiguration$.next(notifications);
    }

}
