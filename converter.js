const path = require('path');

const flatten = arr => arr.reduce((a, b) => a.concat(b), []);

const arrayRegex = /^(.+)\[\]$/;
const simpleCollectionRegex = /^(?:I?List|IReadOnlyList|IEnumerable|ICollection|HashSet)<([\w\d]+)>\??$/;
const collectionRegex = /^(?:I?List|IReadOnlyList|IEnumerable|ICollection|HashSet)<(.+)>\??$/;
const simpleDictionaryRegex = /^(?:I?Dictionary|SortedDictionary)<([\w\d]+)\s*,\s*([\w\d]+)>\??$/;
const dictionaryRegex = /^(?:I?Dictionary|SortedDictionary)<([\w\d]+)\s*,\s*(.+)>\??$/;

const defaultTypeTranslations = {
    int: 'number',
    double: 'number',
    float: 'number',
    Int32: 'number',
    Int64: 'number',
    short: 'number',
    long: 'number',
    decimal: 'number',
    bool: 'boolean',
    DateTime: 'string',
    DateTimeOffset: 'string',
    Guid: 'string',
    dynamic: 'any',
    object: 'any',
};

const createConverter = config => {
    const typeTranslations = Object.assign({}, defaultTypeTranslations, config.customTypeTranslations);

    const convert = json => {
        const files = json.map(file => {
            const filepath = path.relative(process.cwd(), file.FilePath);

            file.Models = file.Models.map(model => convertModel(model, filepath))
            file.Enums = file.Enums.map(enum_ => convertEnum(enum_, filepath))
            file.mergedModels=[
                ...file.Models.filter(x=> x.length > 0),
                ...file.Enums.filter(x=> x.length > 0)
            ]

            return file;
        });
        const filteredContent = files.filter(x => x.mergedModels.length > 0);

        if (config.namespace) {
            return [
                `declare module ${config.namespace} {`,
                ...filteredContent,
                '}',
            ].join('\n');
        } else {
            return filteredContent;
        }
    };

    const convertModel = (model, filepath) => {
        const content = [];

        if (model.BaseClasses) {
            model.IndexSignature = model.BaseClasses.find(type => type.match(dictionaryRegex));
            model.BaseClasses = model.BaseClasses.filter(type => !type.match(dictionaryRegex));
        }

        const members = [...model.Fields, ...model.Properties];
        const baseClasses = model.BaseClasses && model.BaseClasses.length ? ` extends ${model.BaseClasses.join(', ')}` : '';

        if (members.length > 0 || model.IndexSignature) {
            content.push(`// ${filepath}`);
            content.push(`export interface ${model.ModelName}${baseClasses} {`);

            if (model.IndexSignature) {
                content.push(`    ${convertRecord(model.IndexSignature)};`);
            }

            members.forEach(member => {
                content.push(`    ${convertProperty(member)};`);
            });

            content.push(`}\n`);
        }
        return flatten(content).map(row => config.namespace ? `    ${row}` : row).join('\n');
    };

    const convertEnum = (enum_, filepath) => {
        const rows = [];
        rows.push(`// ${filepath}`);

        const entries = Object.entries(enum_.Values);

        const getEnumStringValue = (value) => config.camelCaseEnums
            ? value[0].toLowerCase() + value.substring(1)
            : value;

        if (config.stringLiteralTypesInsteadOfEnums) {
            rows.push(`export type ${enum_.Identifier} =`);

            entries.forEach(([key], i) => {
                const delimiter = (i === entries.length - 1) ? ';' : ' |';
                rows.push(`    '${getEnumStringValue(key)}'${delimiter}`);
            });

            rows.push('');
        } else {
            rows.push(`export enum ${enum_.Identifier} {`);

            entries.forEach(([key, value], i) => {
                if (config.numericEnums) {
                    rows.push(`    ${key} = ${value != null ? value : i},`);
                } else {
                    rows.push(`    ${key} = '${getEnumStringValue(key)}',`);
                }
            });

            rows.push(`}\n`);
        }

        return flatten(rows).map(row => config.namespace ? `    ${row}` : row).join('\n');
    };

    const convertProperty = property => {
        const optional = property.Type.endsWith('?');
        const identifier = convertIdentifier(optional ? `${property.Identifier.split(' ')[0]}?` : property.Identifier.split(' ')[0]);

        const type = parseType(property.Type);

        return `${identifier}: ${type}`;
    };

    const convertRecord = indexType => {
        const dictionary = indexType.match(dictionaryRegex);
        const simpleDictionary = indexType.match(simpleDictionaryRegex);

        propType = simpleDictionary ? dictionary[2] : parseType(dictionary[2]);

        return `Record<${convertType(dictionary[1])}, ${convertType(propType)}>`;
    };

    const parseType = propType => {
        const array = propType.match(arrayRegex);
        if (array) {
            propType = array[1];
        }

        const collection = propType.match(collectionRegex);
        const dictionary = propType.match(dictionaryRegex);

        let type;

        if (collection) {
            const simpleCollection = propType.match(simpleCollectionRegex);
            propType = simpleCollection ? collection[1] : parseType(collection[1]);
            type = `${convertType(propType)}[]`;
        } else if (dictionary) {
            type = `${convertRecord(propType)}`;
        } else {
            const optional = propType.endsWith('?');
            type = convertType(optional ? propType.slice(0, propType.length - 1) : propType);
        }

        return array ? `${type}[]` : type;
    };

    const convertIdentifier = identifier => config.camelCase ? identifier[0].toLowerCase() + identifier.substring(1) : identifier;
    const convertType = type => type in typeTranslations ? typeTranslations[type] : type;

    return convert;
};

module.exports = createConverter;
