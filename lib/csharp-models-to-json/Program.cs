using System;
using System.Collections.Generic;
using Ganss.IO;
using Microsoft.CodeAnalysis;
using Microsoft.CodeAnalysis.CSharp;
using Microsoft.CodeAnalysis.CSharp.Syntax;
using Microsoft.Extensions.Configuration;
using Newtonsoft.Json;

namespace CSharpModelsToJson
{
  class File
  {
    public string FilePath { get; set; }
    public string OutputPath { get; set; }
    public IEnumerable<Model> Models { get; set; }
    public IEnumerable<Enum> Enums { get; set; }
  }


  class Program
  {
    static void Main(string[] args)
    {
      if (args == null || args.Length == 0)
      {
        throw new Exception("no arguments provided, please read the guide.");
      }
      else if (string.IsNullOrEmpty(args[0]))
      {

        throw new Exception("Please provide config file path");
      }
      IConfiguration config = new ConfigurationBuilder()
          .AddJsonFile(args[0], true, true)
          .Build();

      Dictionary<string, List<string>> includes = new Dictionary<string, List<string>>();
      List<string> excludes = new List<string>();
      
      config.Bind("include", includes);
      config.Bind("exclude", excludes);

      List<File> files = new List<File>();
      
      foreach (File file in getFiles(includes, excludes))
      {
        files.Add(parseFile(file));
      }

      string json = JsonConvert.SerializeObject(files);
      System.Console.WriteLine(json);
    }

    static List<File> getFiles(Dictionary<string, List<string>> includes, List<string> excludes)
    {
      List<File> files = new List<File>();

      files.AddRange(expandGlobPatternsForInclude(includes));

      foreach (var path in expandGlobPatternsForExclude(excludes))
      {
        var pathIndex = files.FindIndex(f => f.FilePath == path);
        files.RemoveAt(pathIndex);
      }

      return files;
    }

    static List<File> expandGlobPatternsForInclude(Dictionary<string, List<string>> includes)
    {

      List<File> files = new List<File>();
      foreach (var inc in includes)
      {
        foreach (var pattern in inc.Value)
        {
          var globPaths = Glob.Expand(pattern);

          foreach (var globPath in globPaths)
          {
            files.Add(new File() { OutputPath = inc.Key, FilePath = globPath.FullName });
          }
        }
      }

      return files;
    }
    static List<string> expandGlobPatternsForExclude(List<string> globPatterns)
    {
      List<string> fileNames = new List<string>();

      foreach (string pattern in globPatterns)
      {
        var paths = Glob.Expand(pattern);

        foreach (var path in paths)
        {
          fileNames.Add(path.FullName);
        }
      }

      return fileNames;
    }
    static File parseFile(File file)
    {
      string source = System.IO.File.ReadAllText(file.FilePath);
      SyntaxTree tree = CSharpSyntaxTree.ParseText(source);
      var root = (CompilationUnitSyntax)tree.GetRoot();

      var modelCollector = new ModelCollector();
      var enumCollector = new EnumCollector();

      modelCollector.Visit(root);
      enumCollector.Visit(root);

      return new File()
      {
        FilePath = System.IO.Path.GetFullPath(file.FilePath),
        OutputPath = System.IO.Path.GetFullPath(file.OutputPath),
        Models = modelCollector.Models,
        Enums = enumCollector.Enums
      };
    }
  }
}
