# Como levar o ERP local para outro computador

Este projeto esta configurado para rodar localmente, sem depender do Base44 ou do GitHub para abrir o sistema.

## 1. Arquivo que voce deve levar

Use o ZIP/projeto portatil que esta no HD externo:

`D:\ERP Zuccaro\erp-integra-portatil-20260508-061538.zip`

Ou, se ja estiver extraido, use a pasta:

`D:\ERP Zuccaro\erp-integra-portatil-20260508-061538\erp-integra-portatil-20260508-061538`

Ele leva o codigo do projeto, as configuracoes locais e as instrucoes. Ele nao leva `node_modules`, `dist`, logs ou arquivos temporarios, porque isso deixa o pacote pesado e pode causar problema em outro computador.

Se preferir trabalhar pelo GitHub, use o repositorio novo:

```text
https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git
```

No computador novo:

```powershell
git clone https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git "C:\ERP Zuccaro\ERP-Zuccaro-codeX"
cd "C:\ERP Zuccaro\ERP-Zuccaro-codeX"
npm install
npm run dev -- --host 0.0.0.0
```

## 2. Preparar o computador novo

1. Instale o Node.js LTS pelo site oficial: https://nodejs.org/
2. Extraia o ZIP em uma pasta simples, por exemplo:

   `C:\ERP Zuccaro\erp-integra-portatil`

3. Abra o PowerShell dentro da pasta extraida.
4. Rode:

```powershell
npm install
```

5. Depois rode:

```powershell
npm run dev -- --host 0.0.0.0
```

6. Abra no navegador:

```text
http://localhost:5173/
```

## 3. Confirmar que esta 100% local

O arquivo `.env.local` deve ter estas configuracoes:

```env
VITE_LOCAL_ONLY=true
VITE_BASE44_APP_ID=local-erp-integra
VITE_BASE44_BACKEND_URL=http://localhost:5173/local
VITE_BASE44_API_KEY=
```

Com isso, o sistema usa o banco local do navegador e nao envia alteracoes para Base44 ou GitHub.

## 4. Importante: dados locais ficam no navegador

O codigo do sistema vai no ZIP. Ja os dados cadastrados pelo sistema local ficam no navegador, no `localStorage`.

Este projeto tambem inclui um snapshot local em:

`public/base44-local-snapshot.json`

Quando o ERP abre pela primeira vez em modo local, ele importa esse snapshot automaticamente para o `localStorage`. Esse snapshot foi baixado em modo somente leitura do Base44 e contem os dados de Gestao de Acessos e Cadastros Gerais que foram encontrados no momento da exportacao.

Se voce quer levar tambem os dados ja cadastrados neste computador, faca isso no computador antigo:

1. Abra o ERP em `http://localhost:5173/`.
2. Aperte `F12`.
3. Abra a aba `Console`.
4. Cole este comando:

```javascript
copy(JSON.stringify({
  db: localStorage.getItem('erp_integra_local_db_v1'),
  user: localStorage.getItem('erp_integra_local_user_v1'),
  contexto: localStorage.getItem('contexto_atual'),
  empresa: localStorage.getItem('empresa_atual_id'),
  grupo: localStorage.getItem('group_atual_id')
}, null, 2));
```

5. Cole o resultado em um arquivo chamado `erp-local-data.json` e leve esse arquivo junto.

No computador novo, depois que o sistema abrir:

1. Abra `http://localhost:5173/`.
2. Aperte `F12`.
3. Abra a aba `Console`.
4. Cole este comando, trocando `COLE_AQUI_O_JSON` pelo conteudo do arquivo `erp-local-data.json`:

```javascript
const data = JSON.parse(`COLE_AQUI_O_JSON`);
if (data.db) localStorage.setItem('erp_integra_local_db_v1', data.db);
if (data.user) localStorage.setItem('erp_integra_local_user_v1', data.user);
if (data.contexto) localStorage.setItem('contexto_atual', data.contexto);
if (data.empresa) localStorage.setItem('empresa_atual_id', data.empresa);
if (data.grupo) localStorage.setItem('group_atual_id', data.grupo);
location.reload();
```

## 5. Se nao abrir

Verifique nesta ordem:

1. Confirme que o terminal ainda esta rodando `npm run dev`.
2. Abra exatamente `http://localhost:5173/`.
3. Se aparecer tela branca, rode:

```powershell
npm run build
```

4. Se aparecer erro `spawn EPERM`, normalmente e bloqueio do Windows/antivirus ao executar o `esbuild`. Execute o PowerShell como usuario normal, permita Node.js no Windows Defender e rode `npm install` novamente.
5. Se a porta 5173 estiver ocupada, rode:

```powershell
npm run dev -- --host 0.0.0.0 --port 5174
```

E abra:

```text
http://localhost:5174/
```

## 6. Como continuar o plano de melhoria em outro computador

Depois de abrir o projeto no Codex do outro computador, informe que o arquivo de continuidade e:

```text
STATUS_DO_PROJETO.md
```

E que a regra e seguir:

```text
PLANO_MELHORIA_ERP_ZUCCARO.md
```

O ultimo checkpoint registrado esta no final do `STATUS_DO_PROJETO.md`.
