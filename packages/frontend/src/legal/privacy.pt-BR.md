# Política de Privacidade

*Última atualização: 4 de novembro de 2026*

Esta Política de Privacidade descreve como o DocForge ("nós") coleta, usa e compartilha informações quando você usa o Serviço. Esta política busca cumprir a **Lei Geral de Proteção de Dados (LGPD)** — Lei Federal nº 13.709/2018.

## 1. Dados que coletamos

| Categoria | Exemplos |
|---|---|
| Dados de autenticação | Endereço de e-mail, ID de usuário (fornecidos pelo Clerk) |
| Conteúdo do usuário | Documentos, versões, comentários, imagens e outros arquivos que você ou os agentes que você conecta criam |
| Dados de acesso de agentes | Nomes das chaves de API que você cria e as chamadas feitas com elas |
| Metadados de uso | Datas e horários, atividade em documentos, atividade de sessão |
| Dados de cobrança | Plano e status da assinatura (os dados do cartão ficam com o Stripe, nunca conosco) |

## 2. Como coletamos

- **No cadastro e no login** — pela autenticação do Clerk (OAuth ou e-mail e senha)
- **Durante o uso** — quando você, ou um agente usando uma das suas chaves de API, cria ou altera documentos
- **No navegador** — análise de produto, gravações de sessão, mapas de cliques, desempenho de página e relatórios de erro só rodam depois que você aceita os cookies
- **Nos nossos servidores** — eventos de uso da sua conta (por exemplo: um documento foi criado, um agente chamou uma ferramenta, uma alteração foi revisada). Eles nunca contêm o texto dos documentos. Se você não aceitou os cookies, esses eventos são anônimos: levam um pseudônimo irreversível no lugar do seu ID de usuário e nenhum e-mail, plano ou outro dado de perfil

## 3. Finalidade do tratamento

| Finalidade | Base legal (LGPD art. 7º) |
|---|---|
| Autenticação e gestão da conta | Execução de contrato (art. 7º, V) |
| Armazenar, versionar e publicar documentos | Execução de contrato (art. 7º, V) |
| Cobrança dos planos pagos | Execução de contrato (art. 7º, V) |
| Melhoria do Serviço e correção de erros, incluindo eventos de uso anônimos no servidor e relatórios de erro | Legítimo interesse (art. 7º, IX) |
| Análise no navegador, gravações de sessão e eventos de uso ligados à sua conta | Consentimento (art. 7º, I) |

## 4. Compartilhamento de dados

Compartilhamos dados apenas com os fornecedores que operam partes do Serviço:

| Fornecedor | Finalidade |
|---|---|
| **Clerk** | Autenticação e gestão de identidade |
| **PostHog** | Análise de produto e relatórios de erro. No navegador, só após o consentimento. As gravações de sessão mascaram todo o texto dos documentos (nos dois editores, painéis, comentários e títulos) e escondem imagens; páginas de link público nunca são gravadas e seus links nunca são enviados |
| **Stripe** | Processamento de pagamentos dos planos pagos |

O DocForge não envia seus documentos a fornecedores de modelos de IA. Os agentes de IA que você conecta rodam do seu lado, sob os seus próprios acordos com os fornecedores deles.

Documentos que você publica, ou compartilha por link público, podem ser lidos por qualquer pessoa que tenha o link.

Não vendemos seus dados pessoais a terceiros.

## 5. Armazenamento e retenção

Documentos e dados de usuários ficam em um banco PostgreSQL em um servidor virtual privado alugado da Contabo. Mantemos seus dados enquanto sua conta estiver ativa. Quando a conta é excluída, seus dados são removidos em até **30 dias**.

## 6. Seus direitos (LGPD art. 18)

Como titular de dados sob a LGPD, você tem direito a:

- **Acesso** aos seus dados pessoais que mantemos
- **Correção** de dados incompletos ou inexatos
- **Eliminação** dos seus dados pessoais
- **Portabilidade** dos seus dados, quando tecnicamente viável
- **Revogação do consentimento** a qualquer momento, quando o tratamento se basear nele
- **Informação** sobre os terceiros com quem seus dados são compartilhados

Para exercer qualquer um desses direitos, escreva para: **maxjneto@gmail.com**

## 7. Segurança

Adotamos medidas técnicas e organizacionais razoáveis para proteger seus dados, incluindo criptografia no transporte (HTTPS), gestão de credenciais pelo Clerk, chaves de API guardadas apenas como hash e banco de dados com acesso controlado. Nenhum meio de transmissão pela internet é 100% seguro; não podemos garantir segurança absoluta.

## 8. Privacidade de menores

O Serviço não se destina a menores de 18 anos. Não coletamos conscientemente dados pessoais de menores.

## 9. Mudanças nesta política

Podemos atualizar esta Política de Privacidade de tempos em tempos. Continuar usando o Serviço depois das mudanças significa aceitar a política atualizada. Recomendamos revisitar esta página periodicamente.

## 10. Contato

Para pedidos sobre privacidade, direitos do titular ou qualquer dúvida sobre esta política:

**maxjneto@gmail.com**
