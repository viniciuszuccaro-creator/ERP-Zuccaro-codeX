import assert from 'node:assert/strict';
import ts from 'typescript';

function replace(source,current,previous,count=1){
  assert.equal(source.split(current).length-1,count,`Exact browser/form hunk: ${current}`);
  return source.replaceAll(current,previous);
}
function removeFunction(file,source,name){
  const tree=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true,ts.ScriptKind.JSX);
  const nodes=tree.statements.filter(node=>ts.isFunctionDeclaration(node)&&node.name?.text===name);
  assert.equal(nodes.length,1);const node=nodes[0];
  return source.slice(0,node.getStart(tree))+source.slice(node.end);
}
export function browserFormBoundaryRemainder(file,source){
  if(file==='src/components/lib/networkGuard.jsx'){
    source=replace(source,"  if (Reflect.get(window, '__networkGuardInitialized')) return;\n  if (!Reflect.set(window, '__networkGuardInitialized', true)) throw new TypeError('Network guard initialization blocked.');","  if (window.__networkGuardInitialized) return;\n  window.__networkGuardInitialized = true;");
    source=replace(source,"const urlStr = typeof input === 'string' ? input : (input instanceof URL ? input.href : input.url);","const urlStr = typeof input === 'string' ? input : (input && input.url ? input.url : '');");
    source=replace(source,"(input instanceof Request ? input.headers : undefined)","(typeof input !== 'string' && input && input.headers)");
  }
  if(file==='src/lib/app-params.js'){
    source=replace(source,'const storage = isNode ? null : window.localStorage;','const windowObj = isNode ? { localStorage: new Map() } : window;\nconst storage = windowObj.localStorage;');
    source=replace(source,'import.meta.env?.VITE_BASE44_APP_ID','import.meta.env.VITE_BASE44_APP_ID');
    source=replace(source,'import.meta.env?.VITE_BASE44_BACKEND_URL','import.meta.env.VITE_BASE44_BACKEND_URL');
    source=replace(source,'defaultValue: isNode ? undefined : window.location.href','defaultValue: window.location.href');
  }
  if(file==='src/components/common/FormErrorSummary.jsx'){
    source=removeFunction(file,source,'formErrorMessage');
    source=replace(source,'{formErrorMessage(m)}',"{typeof m === 'string' ? m : (m?.message || 'Campo inválido')}");
  }
  if(file==='src/components/common/FormWrapper.jsx'){
    source=removeFunction(file,source,'normalizeFormValidationModes');
    source=replace(source,'  const validationModes = normalizeFormValidationModes(mode, reValidateMode);','');
    source=replace(source,'    mode: validationModes.mode,','    mode,');
    source=replace(source,'    reValidateMode: validationModes.reValidateMode,','    reValidateMode,');
  }
  const fields={
    'src/components/compras/CotacaoForm.jsx':['data_limite_resposta','descricao'],
    'src/components/compras/OrdemCompraForm.jsx':['fornecedor_id','data_solicitacao','itens'],
    'src/components/compras/SolicitacaoCompraForm.jsx':['data_solicitacao','produto_id','quantidade_solicitada','justificativa'],
  };
  if(fields[file]){
    source=file.endsWith('SolicitacaoCompraForm.jsx')
      ?replace(source,'import { formErrorMessage } from "@/components/common/FormErrorSummary";','')
      :replace(source,'import FormErrorSummary, { formErrorMessage } from "@/components/common/FormErrorSummary";','import FormErrorSummary from "@/components/common/FormErrorSummary";');
    for(const field of fields[file])source=replace(source,`formErrorMessage(errors.${field}.message)`,`errors.${field}.message`);
  }
  if(file==='src/components/sistema/ConfigGlobal.jsx')source=replace(source,'const [savingField, setSavingField] = useState(/** @returns {Record<string, boolean>} */ () => ({}));','const [savingField, setSavingField] = useState({});');
  if(file==='src/components/lib/WindowManager.jsx')source=replace(source,'const WindowContext = createContext(undefined);','const WindowContext = createContext();');
  if(file==='src/lib/AuthContext.jsx')source=replace(source,'const AuthContext = createContext(undefined);','const AuthContext = createContext();');
  return source;
}
