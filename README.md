# PRO MEAT - Gestão Desossa

Prompt para o Lovable

Crie uma aplicação web moderna, responsiva e com interface profissional para gestão de desossa de açougues, funcionando tanto em Desktop quanto em dispositivos Mobile, utilizando uma arquitetura escalável que permita futuramente atender múltiplos açougues (Multi-Tenant), porém nesta primeira versão (MVP) será utilizada apenas por um único estabelecimento.

Objetivo

Desenvolver um Sistema de Gestão de Desossa que permita controlar todo o processo desde a entrada da carne até o resultado final da desossa, gerando indicadores de produtividade, rendimento, perdas e sugestões de precificação.

A aplicação deverá possuir uma interface limpa, intuitiva, rápida e otimizada para uso em frigoríficos e açougues, permitindo que o administrador utilize o sistema no computador e que os açougueiros realizem suas atividades através do celular.

Perfis de Usuário

Administrador

Possui acesso total ao sistema.

Pode:

Cadastrar fornecedores

Cadastrar produtos

Cadastrar funcionários (Açougueiros)

Iniciar ordens de desossa

Acompanhar andamento

Consultar relatórios

Gerenciar cadastros

Açougueiro

Utiliza exclusivamente o aplicativo pelo celular.

Pode:

Visualizar ordens de desossa atribuídas a ele

Iniciar uma desossa

Informar pesos das peças extraídas

Informar descartes

Finalizar a desossa

Dashboard Inicial

Ao acessar o sistema o Administrador visualizará:

Total de desossas do dia

Peso recebido

Peso aproveitado

Peso perdido

Rendimento médio (%)

Últimas desossas

Ordens em andamento

Gráfico de aproveitamento

Ranking de fornecedores

Ranking de açougueiros

Cadastros

Fornecedores

Campos:

Razão Social

Nome Fantasia

CNPJ

Contato

Telefone

E-mail

Observações

Funcionários

Campos:

Nome

CPF

Cargo

Login

Senha

Status

Categorias de Produtos

Criar inicialmente as categorias mais comuns em açougues:

Dianteiro Bovino

Traseiro Bovino

Frango

Suíno

Ovino

Miúdos

Outros

Produtos

Cada produto deverá possuir:

Nome

Categoria

Código

Unidade (Kg)

Peso Médio

Observações

Exemplos:

Dianteiro

Acém

Paleta

Peito

Cupim

Traseiro

Alcatra

Picanha

Contra Filé

Patinho

Coxão Mole

Coxão Duro

Lagarto

Maminha

Fraldinha

Frango

Peito

Asa

Coxa

Sobrecoxa

Tulipa

Suíno

Pernil

Paleta

Costela

Lombo

Panceta

Entrada de Produtos

Registrar:

Fornecedor

Produto

Categoria

Peso Bruto

Data

Número da Nota

Valor da Compra

Lote

Observações

Esses registros formarão o estoque bruto disponível para desossa.

Ordem de Desossa

O Administrador deverá criar uma nova Ordem de Desossa.

Campos:

Produto

Fornecedor

Peso Inicial

Data

Funcionário responsável

Observações

Status:

Pendente

Em andamento

Finalizada

Ao salvar, essa ordem deverá aparecer automaticamente no aplicativo Mobile do açougueiro.

Aplicativo Mobile do Açougueiro

Tela inicial:

Minhas Desossas

Cada card mostrará:

Produto

Peso Inicial

Fornecedor

Data

Botão:

"Iniciar Desossa"

Durante a Desossa

O açougueiro irá cadastrando todas as peças extraídas.

Para cada peça informar:

Produto

Peso

Quantidade

Observações

Exemplo:

Picanha

2,15 Kg

Adicionar

Contra Filé

5,30 Kg

Adicionar

Alcatra

4,80 Kg

Adicionar

...

A lista deverá permitir adicionar quantas peças forem necessárias.

Registro de Perdas

Ao final informar também:

Peso dos Ossos

Peso da Gordura

Peso dos Retalhos

Perdas

Descarte

Outros

Finalização da Desossa

Ao concluir, o sistema deverá realizar automaticamente a conciliação.

Cálculos:

Peso Inicial

(-)

Somatório de todas as peças

(-)

Ossos

(-)

Gordura

(-)

Perdas

=

Saldo

Caso exista diferença relevante entre o peso inicial e o peso informado, destacar em vermelho.

Indicadores Gerados

O sistema deverá calcular automaticamente:

Rendimento (%)

Perda (%)

Peso aproveitado

Peso descartado

Aproveitamento por fornecedor

Aproveitamento por produto

Aproveitamento por funcionário

Média histórica

Peso médio por peça

Custo por Kg

Preço sugerido de venda

Margem estimada

Relatórios

Criar relatórios com filtros por:

Período

Fornecedor

Produto

Funcionário

Categoria

Exibir:

Tabela

Gráficos

Indicadores

Possibilidade futura de exportação para Excel e PDF.

Layout

Utilizar um visual moderno semelhante a sistemas ERP.

Características:

Menu lateral

Cards

Gráficos

Tabelas modernas

Tema claro

Ícones

Responsivo

Excelente experiência tanto em Desktop quanto Mobile.

Tecnologias sugeridas

Frontend:

React

TypeScript

Tailwind CSS

Backend:

Supabase

Banco:

PostgreSQL

Autenticação:

Supabase Auth

Gráficos:

Recharts

Estrutura preparada para expansão

Embora esta versão seja destinada a um único açougue, toda a arquitetura deve ser preparada para suportar múltiplos açougues futuramente (Multi-Tenant), permitindo isolamento de dados por empresa.

Objetivo desta versão

Esta é uma MVP (Minimum Viable Product) destinada à apresentação para um cliente, com foco em validar:

A experiência do usuário.

O fluxo operacional da desossa.

A facilidade de utilização pelos açougueiros.

A viabilidade técnica do módulo.

O potencial para evolução em um sistema completo de gestão de açougues.

A interface deve transmitir profissionalismo, simplicidade e velocidade, permitindo que o cliente visualize claramente como o processo funcionará no dia a dia.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://iga-app-desossa.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/6c6e31c0-b2ae-4143-8f0e-f99504bba695).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
