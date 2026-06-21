# Decisões & Premissas — Culture Monitor (mockup)

Registro de decisões de produto e **premissas assumidas** neste mockup, com
status. Premissas marcadas **(a validar)** precisam ser confirmadas com o
cliente (live.tt) antes de virarem requisito firme.

Status possíveis: `Assumido (a validar)` · `Decidido` · `Divergência conhecida`.

---

## D1 — Território/Tópico é transversal à plataforma
**Status:** Assumido (a validar)

**Contexto:** A ferramenta é multiplataforma — TikTok hoje; Instagram e X no
roadmap do deck. Surge a dúvida: a taxonomia Território/Tópico é **transversal**
às plataformas ou **subordinada** a cada uma?

**Premissa:** Território/Tópico é **transversal** (ortogonal à plataforma). A
taxonomia é cultural e cross-platform; a **plataforma é só um atributo do post**
(`platform`); um tópico **agrega** posts de várias plataformas.

**Justificativa:**
- O deck lista *Território · Tópico · Contexto · **Fonte** · Período* como
  filtros paralelos — co-iguais ⇒ eixos ortogonais.
- O produto é "análise de **cultura**"; cultura atravessa plataforma.
- O roadmap "TikTok → Instagram → X" escala **fontes** sob a mesma taxonomia.
- No código já está assim: `topics` e `platform` são independentes, e o filtro
  Fonte atua **dentro** de um tópico (só faz sentido se o tópico for cross-platform).

**A elicitar:**
1. Taxonomia igual entre plataformas, ou há tópicos plataforma-específicos?
2. Robô é por tópico (varrendo várias plataformas) ou por (tópico × plataforma)?
3. Mesmo conteúdo em 2 plataformas = posts separados ou um só com várias fontes?
4. Tipo de Expressão é transversal ou tende a ser moldado pela plataforma?

---

## D2 — Modelo de curadoria: pré-classificação do robô + aprovação do curador
**Status:** Decidido (alinhado ao deck)

O robô pré-classifica **Território · Tópico · Tipo de Expressão**; o curador
**confirma e enriquece** com **Contexto** e **Marca vinculada**, e **aprova**
(trava de completude: Tipo de Expressão obrigatório). Post manual chega sem
pré-classificação (inclusão "tradicional") e é classificado pelo curador.

---

## D3 — Curadoria escopada por tópico (vs. timeline única filtrável)
**Status:** Divergência conhecida

Construímos **um Timeline/Workspace por tópico**, com seletor de contexto
Território→Tópico. O deck mostra **uma timeline única filtrável** por
Território/Tópico/Contexto/Fonte/Período. Funcionalmente equivalentes; a decidir
se alinhamos 100% ao deck depois.

---

## D4 — Nomenclatura divergente do deck
**Status:** Divergência conhecida

- Destino da curadoria: usamos **"Workspace"**; o deck fala **"Murais"**.
- Descartados: usamos **"Descarte"**; o deck usa **"Conteúdos Rejeitados"**.
- A decidir qual vocabulário adotar como oficial.

---

## D5 — "Tipo de Expressão": vocabulário provisório
**Status:** Assumido (a validar)

Sem lista oficial, usamos um chute: **Comunidade · Meme · Formato · Tendência ·
Notícia**. O robô pode pré-classificar isso automaticamente. **Âncora:** o Lucas
usa "expressões da cultura rápida" (reunião 18/06), o que legitima o eixo — mas o
**vocabulário oficial precisa ser confirmado** com o cliente.

---

## D6 — Multiplataforma explícita, sem simular dados
**Status:** Decidido

Plataforma é dimensão de primeira classe (selo no card + filtro **Fonte**).
TikTok ativo; Instagram e X aparecem como **"em breve"** (desabilitados). Não
criamos posts fake de outras plataformas — explicitamos o conceito sem
comprometer a credibilidade da demo.

---

## D7 — Curadoria com filtro forte (alinhado ao Lucas)
**Status:** Decidido (alinhado ao cliente)

O feed deve ser **curadoria forte** — mostrar só os ~3–5% que realmente
importam, um feed compacto ("tesouro, não junk"), não "mostrar tudo". A força do
filtro é resultado da **calibração dos robôs**, *tunável ao longo da operação*.
Substitui a posição inicial (Altigran) de "sem filtro". Fonte: reunião 18/06 —
Lucas insistiu nos 3–5% e na qualidade do feed.

## D8 — Aprendizado ao longo do tempo (não reprocessar o passado)
**Status:** Decidido

Os **sinais** gerados pela curadoria diária (o que é salvo/descartado, notas,
categorias) são capturados continuamente e usados para **treinar e calibrar os
robôs**. **Não** vamos reprocessar o histórico manual do Slack (genérico e
custoso): como os ciclos são diários e a coleta passa a ser em escala, a perda é
pequena. Concilia o desejo do Lucas ("aprender por que foi escolhido") aplicado
**para frente**, em vez de fazer backfill do passado.

## D9 — Modelo de coleta: lote passivo + inclusão manual
**Status:** Decidido

A coleta é um **lote passivo do robô** (alimenta a Timeline) + **inclusão
manual** (a via "tradicional"). **Descartada** a ideia de um "assistente de
coleta interativo" (busca ao vivo na rede / consultas salvas / nível de
automação ajustável) levantada na reunião — o modelo passivo + manual ficou mais
simples e mais alinhado.

---

## D10 — Banco de curadoria como ativo; cultura rápida × lenta; agente futuro
**Status:** Documentado (futuro — fora do mockup)

O banco resultante da curadoria é o **ativo central** ("tesouro"). Visão de
futuro (Altigran): um **agente de análise de cultura** sobre esse banco, estilo
*deep researcher*. Mapeamento conceitual: **Território ≈ lente de cultura lenta**
(tensões culturais); **Tópico/posts ≈ cultura rápida** (expressões observáveis).
Hoje a cultura lenta é um departamento à parte (Lucas); cruzar rápida × lenta na
base é visão futura. **Nada disso muda o mockup agora.**

## D11 — Granularidade de território: em aberto
**Status:** Em aberto

O Lucas chama "território futebol" (linha 78) — nível do nosso **Tópico** — e
amarra território à **unidade comercial/de monitoramento** (1 robô, vendável a
vários clientes). Estruturalmente nosso "1 robô = 1 tópico" provavelmente já casa
(é mais questão de **nomenclatura/nível**). Decisão depende da modelagem final —
**seguimos sem definir** por ora.

## D12 — Contribuição humana entra com prioridade
**Status:** Decidido (implementado)

Posts de inclusão humana (manual) entram na Timeline **com prioridade** — sobem
ao topo, com realce visual (chip "★ prioritário" + borda). Alinha com o Lucas
(reunião 18/06): contribuição humana entra "com peso de super selecionado, lado a
lado com o automático".
