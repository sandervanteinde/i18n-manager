# i18n-manager README

Manage your i18n tags in a more user friendly way!

## Features

This extension gives you a webview that monitors all your i18n tags in your application.
You can access this webview by opening the command `>Open i18n manager`

## Fixers
The i18n-manager also includes auto-fixers. These fixers can be accessed through the i18n manager as described above.

The fixers can automatically replace i18n content on your page with new content so that it is uniform across your application.

**NOTICE:** Always check after running a fixer if it has given you the wanted result. The files are not saved and opened for you to validate. You have to save the files yourself after you validated it. My recommendation is to run some kind of source control so you can always roll back.

## Auto completion
The i18n manager has auto completion and is able to auto complete i18n tags. If you are in a HTML file and you are typing within a i18n tag, you will get suggested i18n ids based on the ones available in your solution. It will also automatically fill the content of the matching attribute or body.

This is enabled by default, and can be disabled through the `sandervanteinde.i18n-manager.language.i18nHtmlAutoCompletion` property.

## Known Issues

- Does not work with i18n attributes that do not have an identifier
- Does not work in the `@Component({template: ''})` templates
- Autocompletion fails when trying to autocomplete an i18n tag in a incomplete HTML tag

## Attribution

<div>Icon made by <a href="https://www.freepik.com/" title="Freepik">Freepik</a> from <a href="https://www.flaticon.com/"                 title="Flaticon">www.flaticon.com</a> is licensed by <a href="http://creativecommons.org/licenses/by/3.0/"                 title="Creative Commons BY 3.0" target="_blank">CC 3.0 BY</a></div>
