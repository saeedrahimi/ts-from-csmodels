#!/usr/bin/env node

const fs = require('fs');
const process = require('process');
const path = require('path');
const {spawn} = require('child_process');

const createConverter = require('./converter');

const configArg = process.argv.find(x => x.startsWith('--config='));

if (!configArg) {
    return console.error(
        'No configuration file for `cs-models-to-json` provided.'
    );
}

const configPath = configArg.substr('--config='.length);
let config;

try {
    unparsedConfig = fs.readFileSync(configPath, 'utf8');
} catch (error) {
    return console.error(`Configuration file "${configPath}" not found.`);
}

try {
    config = JSON.parse(unparsedConfig);
} catch (error) {
    return console.error(
        `Configuration file "${configPath}" contains invalid JSON.`
    );
}


const converter = createConverter({
    customTypeTranslations: config.customTypeTranslations || {},
    namespace: config.namespace,
    camelCase: config.camelCase || false,
    camelCaseEnums: config.camelCaseEnums || false,
    numericEnums: config.numericEnums || false,
    stringLiteralTypesInsteadOfEnums:
        config.stringLiteralTypesInsteadOfEnums || false,
});

let timer = process.hrtime();

const dotnetProject = path.join(__dirname, 'lib/cs-models-to-json');
const dotnetProcess = spawn(
    'dotnet',
    ['run', `--project "${dotnetProject}"`, `"${path.resolve(configPath)}"`],
    {shell: true}
);

let stdout = '';

dotnetProcess.stdout.on('data', data => {
    stdout += data;
});

dotnetProcess.stderr.on('data', err => {
    console.error(err.toString());
});

dotnetProcess.stdout.on('end', () => {
    let json;

    try {
        json = JSON.parse(stdout);
    } catch (error) {
        return console.error(
            [
                'The output from `cs-models-to-json` contains invalid JSON.',
                error.message,
                stdout,
            ].join('\n\n')
        );
    }

    const files = converter(json);
    files.forEach(file => {
        file.mergedModels.forEach(model => {

            const filename = file.FilePath.replace(/^.*[\\\/]/, '').split('.')[0]
            const outputFile = path.join(file.OutputPath, filename + '.ts'); 
            

            if (!fs.existsSync(file.OutputPath)){
                fs.mkdirSync(file.OutputPath);
            }
            fs.writeFile(outputFile, model, err => {
                if (err) {
                    return console.error(err);
                }

                timer = process.hrtime(timer);
                console.log('Done in %d.%d seconds.', timer[0], timer[1]);
            });
        });
    });
});
