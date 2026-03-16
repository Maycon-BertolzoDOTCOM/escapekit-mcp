<![<arg_value>import { Project } from 'ts-morph';
import * as fs from 'fs/promises';

export interface MethodInfo {
  name: string;
  parameters: ParameterInfo[];
  returnType: string;
  isAsync: boolean;
  visibility: 'public' | 'private' | 'protected';
}

export interface ParameterInfo {
  name: string;
  type: string;
  isOptional: boolean;
}

export interface ImportInfo {
  module: string;
  namedImports?: string[];
  defaultImport?: string;
}

export interface DetectorAnalysis {
  className: string;
  fileName: string;
  filePath: string;
  methods: MethodInfo[];
  dependencies: string[];
  imports: ImportInfo[];
}

export class ASTAnalyzer {
  private project: Project;

  constructor() {
    this.project = new Project({
      skipAddingFilesFromTsConfig: true,
      compilerOptions: {
        target: 3, // ES2022
        module: 99, // ESNext
        esModuleInterop: true
      }
    });
  }

  async analyze(filePath: string): Promise<DetectorAnalysis> {
    // Check if file exists
    try {
      await fs.access(filePath);
    } catch {
      throw new Error(`File not found: ${filePath}`);
    }

    const sourceFile = this.project.addSourceFileAtPath(filePath);
    const classes = sourceFile.getClasses();
    
    if (classes.length === 0) {
      throw new Error('No classes found in file');
    }

    const detectorClass = classes[0];
    const methods = this.extractMethods(detectorClass);
    const imports = this.extractImports(sourceFile);

    return {
      className: detectorClass.getName(),
      fileName: sourceFile.getBaseName(),
      filePath,
      methods,
      dependencies: this.extractDependencies(sourceFile),
      imports
    };
  }

  private extractMethods(detectorClass: any): MethodInfo[] {
    return detectorClass.getMethods().map((method: any) => ({
      name: method.getName(),
      parameters: method.getParameters().map((param: any) => ({
        name: param.getName(),
        type: param.getType().getText(),
        isOptional: param.hasQuestionToken()
      })),
      returnType: method.getReturnType().getText(),
      isAsync: method.isAsync(),
      visibility: this.getVisibility(method)
    }));
  }

  private getVisibility(method: any): 'public' | 'private' | 'protected' {
    return method.isPublic() ? 'public' : 
           method.isPrivate() ? 'private' : 'protected';
  }

  private extractImports(sourceFile: any): ImportInfo[] {
    return sourceFile.getImportDeclarations().map((imp: any) => ({
      module: imp.getModuleSpecifierValue(),
      namedImports: imp.getNamedImports().map((ni: any) => ni.getName()),
      defaultImport: imp.getDefaultImport()?.getText()
    }));
  }

  private extractDependencies(sourceFile: any): string[] {
    const imports = sourceFile.getImportDeclarations();
    return imports
      .map((imp: any) => imp.getModuleSpecifierValue())
      .filter((module: string) => 
        !module.startsWith('.') && !module.startsWith('/')
      );
  }
}
