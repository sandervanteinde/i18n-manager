# Changelog
## [0.6.0] - 2020-07-07
### Added
- Search i18n command

## [0.5.4] - 2020-01-22
### Fixes
- The ignoring of node_modules files of 0.5.1 is restored here.

## [0.5.3] - 2020-01-21
### Fixes
- The title was missing an interpolation marker.

## [0.5.2] - 2020-01-20
### Changes
- The display of the titles in the i18n manager changed to display the amount of values

## [0.5.1] - ??
### Added
- Ignore node_modules HTML files.

## [0.5.0] - 2019-06-29
### Added
- Autocompletion

## [0.4.1] - 2019-06-25
### Added
- Validator for Angular interpolations

### Changes
- Fixers are now single-button and they work through the vscode internal prompt
- The i18n content fixer now has the possibility of adding a completely new message

## [0.4.0] - 2019-06-23
### Added
- Use Angular compiler to parse HTML
- Added fixers - They make life easier to do basic operations. The following fixers are implemented:
    - A fixer for non-matching values: Choose the value you want to use for all IDs
    - A fixer for translations with HTML: Remove all the HTML in one click
    - A fixer for multiple translations on the same ID: Click to set all IDs for a given translation to that ID.

## [0.3.0] - 2019-06-21
### Added
- Add pattern valdidation of i18n ids
- Added configurations for validating rules

## [0.2.2] - 2019-06-21
### Added
- Global notifications showing amount of warnings and errors in notifications when i18n changes are made
- Shift-clicking links copies the i18n id to the clipboard


## [0.2.1] - 2019-06-20
### Bugfixes
- Fixes tags without value to be shown and clickable in error and warning tables

## [0.2.0] - 2019-06-20
### Added
- Escaping `<` and `>` in i18n values
- Orderign table by Id name
- Live reloading of i18n panel
- Warnings for i18n tags with HTML elements in them

## [0.1.3] - 2019-06-20
### Added
- Gallery banner and icon information

## [0.1.2] - 2019-06-20
### Added
- Bundling of extension using webpack
### Changed
- Really change the changelog this time.

## [0.1.1] - 2019-06-20
### Changed
- Structure of changelog

## [0.1.0] - 2019-06-20

### Added
- Initial release. Could potentially have bugs!
