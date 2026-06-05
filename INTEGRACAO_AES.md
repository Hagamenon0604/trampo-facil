# Integracao do Trampo Facil com o site A&S Gestao

O projeto foi preparado para funcionar de duas formas:

- Plataforma independente: abre o `index.html` normal.
- Plataforma incorporada no site da A&S Gestao: abre o mesmo `index.html` com `?embed=1`.

## Dominio escolhido

```text
vagas.aesgestao.com
```

Esse sera o endereco oficial recomendado para a plataforma.

## Link independente

Quando o projeto estiver hospedado, use:

```text
https://vagas.aesgestao.com/
```

## Link para incorporar no site da A&S

Use a versao sem topo, sem hero e sem faixa institucional:

```text
https://vagas.aesgestao.com/?embed=1
```

## Como colocar no site da A&S

1. Publique este projeto em uma hospedagem, como Vercel, Netlify ou GitHub Pages.
2. Configure o subdominio `vagas.aesgestao.com` no DNS do dominio `aesgestao.com`.
3. No editor do site da A&S, adicione um elemento de incorporacao HTML/iframe.
4. Cole este codigo:

```html
<iframe
  src="https://vagas.aesgestao.com/?embed=1"
  title="Trampo Facil - Vagas para bares e restaurantes"
  style="width: 100%; min-height: 1200px; border: 0;"
></iframe>
```

## Configuracao de DNS

O registro exato depende da hospedagem escolhida:

- Vercel costuma pedir um `CNAME` apontando `vagas` para `cname.vercel-dns.com`.
- Netlify costuma pedir um `CNAME` apontando `vagas` para o dominio Netlify do projeto.
- GitHub Pages costuma pedir um `CNAME` apontando `vagas` para `USUARIO.github.io`.

Exemplo conceitual:

```text
Tipo: CNAME
Nome: vagas
Destino: destino-informado-pela-hospedagem
```

## Como colocar no Wix

1. Publique este projeto em uma hospedagem.
2. No editor do Wix, adicione um elemento de incorporacao HTML/iframe.
3. Cole este codigo:

```html
<iframe
  src="https://vagas.aesgestao.com/?embed=1"
  title="Trampo Facil - Vagas para bares e restaurantes"
  style="width: 100%; min-height: 1200px; border: 0;"
></iframe>
```

## Sugestao de menu

No site da A&S Gestao, crie um item no menu chamado:

```text
Vagas Food Service
```

Tambem pode entrar nas paginas "Para profissionais" e "Para empresas":

- Para profissionais: chamada para cadastrar curriculo.
- Para empresas: chamada para cadastrar vaga.

## Proximo passo recomendado

A versao atual salva dados no navegador com `localStorage`, ideal para prototipo visual. Para virar uma plataforma real, o proximo passo e adicionar:

- banco de dados;
- painel administrativo para a Andrea/A&S;
- login para empresas e candidatos;
- notificacoes por e-mail ou WhatsApp;
- filtros por cidade, cargo, escala e faixa salarial.
