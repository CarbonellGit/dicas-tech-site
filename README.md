# Carbonell Tech Tips

Um portal para compartilhamento de dicas, ferramentas e sistemas voltado para o dia a dia escolar. Desenvolvido exclusivamente para o uso interno de colaboradores.

---

## 👨‍💻 Desenvolvedor e Direitos

* **Desenvolvido por:** Thiago Marques Luiz -  Equipe de TI do Colégio Carbonell 
* **Direitos reservados a:** Colégio Carbonell

A cópia, distribuição ou modificação não autorizada deste código-fonte é proibida.

---

## 🚀 Sobre o Projeto

O **Carbonell Tech Tips** funciona como um catálogo em vídeos estilo Netflix (com _swimlanes_ horizontais) para educar e orientar colaboradores sobre as mais diversas ferramentas tecnológicas da instituição.

A interface conta com suporte a categorização, pesquisa ágil e área restrita para administradores inserirem e removerem vídeos, fazendo upload direto para uso sob demanda. 
A arquitetura é construída via Vanilla JavaScript consumindo backend provido pelo **Firebase** (Authentication, Cloud Firestore, e Cloud Storage).

### Tecnologias Utilizadas

- **Frontend:** HTML5, CSS3 Responsivo, Vanilla JavaScript (ES6 Modules)
- **Backend as a Service (BaaS):** Firebase SDK 11
  - _Firebase Auth_: Autenticação de usuários administradores.
  - _Cloud Firestore_: Banco de dados NoSQL para armazenar meta-dados e links das dicas postadas.
  - _Cloud Storage_: Repositório de vídeos e thumbnails subidos localmente.
- **Ícones**: Lucide Icons
- **Fontes**: Google Fonts (Inter)
- **Bundler / Dev Server**: Vite

---

## 📁 Estrutura de Arquivos

```text
.
├── index.html                  # Interface gráfica principal e estruturação de modais e contêineres vazios.
├── style.css                   # Reforçado com Design System Dark Premium e Media Queries para Responsividade.
├── vite.config.js              # Configuração básica do servidor Vite.
├── package.json                # Gerenciador de módulos NPM.
├── js/                         # Módulos ES6 e lógica do sistema.
│   ├── auth.js                 # Gerenciamento de Autenticação.
│   ├── database.js             # Conexão com Firestore e enviou de Arquivos no Firebase Storage.
│   ├── store.js                # Pattern Observer local state, centralizando variáveis globais e de UI.
│   ├── firebase-config.js      # Ponto de inicialização do App Firebase.
│   ├── ui.js                   # Renderização de DOM, manipulação de cards, e listeners.
│   └── main.js                 # Ponto de Entrada da aplicação; core bootstrapping.
```

---

## ⚙️ Configuração e Execução (Desenvolvimento)

Siga estas instruções para rodar o projeto localmente:

### 1. Pré-requisitos
- [Node.js](https://nodejs.org/) versão 16+ instalada.
- Credenciais e arquivos de ambiente do Firebase (Veja o arquivo `firebase-env.example.js`).

### 2. Instalação e Execução

1. Clone o repositório (`git clone`).
2. Acesse a pasta raiz do projeto.
3. Configure as variáveis de ambiente baseadas no `js/firebase-env.example.js` salvando para `js/firebase-env.js`.
4. Instale as dependências executando:
   ```bash
   npm install
   ```
5. Inicie o servidor de desenvolvimento:
   ```bash
   npm run dev
   ```
   (Se você estiver usando npx, `npx vite` também resolve).
   
### Deploy

O projeto é configurado para ser compilado via Vite (`npm run build`) para uma pasta `.dist` que pode ser enviada e distribuída para qualquer serviço de Host Estático como o **Firebase Hosting**.

`firebase deploy --only hosting`
