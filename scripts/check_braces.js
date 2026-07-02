import fs from 'fs';
const s = fs.readFileSync('src/components/MilkEntries.tsx','utf8');
let i=0,stack=[];
while(i<s.length){
  const ch=s[i];
  if(ch==='"' || ch==="'" || ch==='`'){
    const quote=ch; i++;
    while(i<s.length){
      if(s[i]==='\\') i+=2;
      else if(s[i]===quote){ i++; break; }
      else i++;
    }
    continue;
  }
  if(s[i]==='/' && s[i+1]==='*'){
    i+=2; while(i<s.length && !(s[i]==='*' && s[i+1]==='/')) i++; i+=2; continue;
  }
  if(s[i]==='/' && s[i+1]==='/'){
    i+=2; while(i<s.length && s[i]!=='\n') i++; continue;
  }
  if(s[i]==='{') stack.push(i);
  else if(s[i]==='}'){
    if(stack.length===0){ console.log('Unmatched } at', i); process.exit(0); }
    stack.pop();
  }
  i++;
}
if(stack.length) console.log('Unclosed { count', stack.length, 'first at', stack[0], 'line', s.slice(0,stack[0]).split('\n').length);
else console.log('Braces balanced');
