import ts from 'typescript';
import fs from 'fs';
const fileName = 'src/components/MilkEntries.tsx';
const source = fs.readFileSync(fileName,'utf8');
const sf = ts.createSourceFile(fileName, source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
const diagnostics = ts.getPreEmitDiagnostics(ts.createProgram([fileName], { allowJs: true, jsx: ts.JsxEmit.Preserve, module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ESNext }));
if(diagnostics.length===0){console.log('No diagnostics from TypeScript API'); process.exit(0);} for(const d of diagnostics){const {line, character} = d.file.getLineAndCharacterOfPosition(d.start); console.log(d.messageText, 'at', line+1, character+1);}
