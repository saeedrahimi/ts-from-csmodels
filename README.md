# Generate Typescript form C# models

This is a tool that consumes your C# domain models and types and creates TypeScript declaration files from them. There's other tools that does this but what makes this one different is that it internally uses [Roslyn (the .NET compiler platform)](https://github.com/dotnet/roslyn) to parse the source files, which removes the need to create and maintain our own parser.


[![NPM version][npm-image]][npm-url]


## Dependencies

* [.NET Core SDK](https://www.microsoft.com/net/download/macos)


## Install

```
$ npm install --save ts-from-csmodels
```

## How to use

1. Add a config file to your project that contains for example...

```
{
    "include": {
  
      "./src/output-directory": [ 
        "../../another-csharp-models/first/**/*.cs",
        "../../another-csharp-models/second/models.ts"
       ],
      "./src/another-output-directory": [ 
        "../../another-csharp-models/another/**/*.cs",
      ]  
  
    },
    "camelCase": false,
    "camelCaseEnums": false,
    "numericEnums": false,
    "stringLiteralTypesInsteadOfEnums": false,
    "customTypeTranslations": {
      "ProductName": "string",
      "ProductNumber": "string"
    }
  }
```

2. Add a npm script to your package.json that references your config file...

```
"scripts": {
    "generate-types": "ts-from-csmodels --config=your-config-file.json"
},
```

3. Run the npm script `generate-types` and the output file specified in your config should be created and populated with your models.


## License

MIT © [Saeed Rahimi](https://github.com/saeedrahimi)

[npm-image]: https://img.shields.io/npm/v/ts-from-csmodels.svg
[npm-url]: https://npmjs.org/package/ts-from-csmodels
