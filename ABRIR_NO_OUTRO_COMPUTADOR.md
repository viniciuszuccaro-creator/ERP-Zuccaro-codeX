# Abrir o ERP em outro computador

## 1. Instalar antes

Instale o Node.js LTS:

https://nodejs.org/

## 2. Extrair o ZIP

Extraia o ZIP em uma pasta simples, por exemplo:

```text
C:\ERP Zuccaro\erp-integra-portatil
```

Se for usar GitHub em vez do ZIP, clone o repositorio novo:

```powershell
git clone https://github.com/viniciuszuccaro-creator/ERP-Zuccaro-codeX.git "C:\ERP Zuccaro\ERP-Zuccaro-codeX"
cd "C:\ERP Zuccaro\ERP-Zuccaro-codeX"
```

## 3. Rodar o projeto

Abra o PowerShell dentro da pasta extraida e rode:

```powershell
npm install
npm run dev -- --host 0.0.0.0
```

Depois abra:

```text
http://localhost:5173/
```

## 4. Confirmar modo local

O arquivo `.env.local` deve estar assim:

```env
VITE_LOCAL_ONLY=true
VITE_BASE44_APP_ID=local-erp-integra
VITE_BASE44_BACKEND_URL=http://localhost:5173/local
VITE_BASE44_API_KEY=
```

Assim o sistema abre em modo local e nao grava no Base44 nem no GitHub.

## 5. Se nao abrir

Rode:

```powershell
npm run build
```

Se a porta 5173 estiver ocupada:

```powershell
npm run dev -- --port 5174
```

E abra:

```text
http://localhost:5174/
```

## 6. Continuar o plano de melhoria

Para continuar em outro computador, abra primeiro:

```text
STATUS_DO_PROJETO.md
PLANO_MELHORIA_ERP_ZUCCARO.md
```

O `STATUS_DO_PROJETO.md` tem o ultimo checkpoint, o que ja foi feito e qual deve ser o proximo foco.
