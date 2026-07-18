# Visão Geral do Projeto Nuvem

## 1. O que é o projeto?

O **Nuvem** (codinome técnico: RotaBus-API) é uma plataforma assistida de mobilidade urbana. Ao contrário de aplicativos de navegação convencionais que apresentam interfaces carregadas de mapas complexos e dezenas de botões, o Nuvem propõe uma abordagem simplificada, conversacional e altamente acessível.

A interação central baseia-se no conceito de **Voice-First** (Prioridade na Voz), onde a jornada do usuário é orquestrada por uma assistente de voz interativa que guia o passageiro desde a escolha do destino até a chegada.

## 2. O Problema

Atualmente, o planejamento de rotas de transporte público via aplicativos tradicionais (como Google Maps ou Moovit) exige alta carga cognitiva:
- **Excesso Visual:** As telas possuem muita informação concorrente.
- **Complexidade de Interação:** Exigem digitação precisa, leitura de mapas e interpretação de dezenas de ícones.
- **Inacessibilidade Oculta:** Idosos, PCDs (Pessoas com Deficiência visual ou motora) e indivíduos com baixa literacia digital enfrentam barreiras severas para utilizar essas ferramentas.

## 3. Missão

Democratizar o acesso ao transporte público e à cidade por meio de uma tecnologia inclusiva, reduzindo ao máximo a complexidade da interação humano-computador no contexto da mobilidade urbana.

## 4. Impacto Social

O Nuvem proporciona autonomia para populações vulnerabilizadas. Com uma interface de conversação, o aplicativo devolve a independência para que idosos e pessoas com dificuldades tecnológicas possam ir ao médico, visitar familiares ou transitar pela cidade sem a necessidade de solicitar ajuda constante a terceiros.

## 5. Público-Alvo

1. **Prioridade Máxima:** Idosos e Pessoas com Deficiência (PCDs).
2. **Foco Secundário:** Indivíduos com baixa literacia digital.
3. **Uso Geral:** Qualquer usuário buscando uma experiência "mãos-livres" (hands-free) rápida e objetiva para rotas de ônibus ou caminhada.

## 6. Diferenciais

* **Voice-First (Não Voice-Only):** A voz é a principal forma de interação, mas não a única. A tela e o toque (touch) estão sempre presentes como um fallback essencial de acessibilidade (para ambientes ruidosos ou preferência do usuário).
* **Navegação Guiada Conversacional:** O sistema não apenas cospe resultados, mas gerencia o diálogo (ex: "Encontrei dois hospitais. Qual você prefere?").
* **Baixa Carga Cognitiva:** O uso de cores, tipografia grande, ausência de menus complexos e linguagem extremamente direta.
* **Inteligência Local (Local Intelligence):** Capacidade de entender "apelidos" de locais e referências regionais (ex: mapeamento interno da cidade de Uberaba).

## 7. Visão Futura

O Nuvem continuará a transição de um sistema "reativo a comandos" para um verdadeiro **Assistente Conversacional de Mobilidade**.
A visão futura inclui:
- **Proatividade:** O app aprende a rotina do usuário (ex: sugerir a rota de volta para casa no fim do dia).
- **Adoção Híbrida de IA (LLMs):** Integrar Modelos de Linguagem de Larga Escala (LLM) apenas como providers opcionais (Adapter) para tratar intenções complexas sem acoplar o Core do negócio à IA, garantindo controle determinístico e baixos custos.
- **Expansão Regional Automática:** Evoluir o módulo de Inteligência Local para cobrir outras cidades de forma dinâmica.
