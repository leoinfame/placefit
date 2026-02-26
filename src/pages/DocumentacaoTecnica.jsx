import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { 
  Database, 
  Users, 
  Package, 
  ShoppingCart, 
  Truck, 
  FileText,
  MessageSquare,
  Bell,
  Layers,
  ArrowRight,
  CheckCircle2
} from "lucide-react";

export default function DocumentacaoTecnica() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-blue-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Header */}
        <div className="text-center space-y-4">
          <div className="flex items-center justify-center gap-3">
            <Database className="w-12 h-12 text-blue-600" />
            <h1 className="text-4xl font-bold text-gray-900">PlaceFit</h1>
          </div>
          <h2 className="text-2xl font-semibold text-gray-700">Documentação Técnica</h2>
          <p className="text-gray-600">Arquitetura de Dados e Fluxos do Sistema</p>
          <Badge className="bg-green-600">v1.0 - Atualizado em 26/02/2026</Badge>
        </div>

        <Tabs defaultValue="visao-geral" className="w-full">
          <TabsList className="grid w-full grid-cols-2 lg:grid-cols-4">
            <TabsTrigger value="visao-geral">Visão Geral</TabsTrigger>
            <TabsTrigger value="entidades">Entidades</TabsTrigger>
            <TabsTrigger value="fluxos">Fluxos de Dados</TabsTrigger>
            <TabsTrigger value="integracao">Integrações</TabsTrigger>
          </TabsList>

          {/* VISÃO GERAL */}
          <TabsContent value="visao-geral" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-6 h-6 text-blue-600" />
                  Arquitetura do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-semibold text-lg mb-3">Descrição do Sistema</h3>
                  <p className="text-gray-700 leading-relaxed">
                    O PlaceFit é uma plataforma B2B para o setor fitness que conecta três tipos de usuários: 
                    <strong> Revendedores</strong>, <strong>Fabricantes</strong> e <strong>Transportadoras</strong>. 
                    O sistema permite gerenciamento de catálogos, pedidos, clientes, fretes e atendimento via IA.
                  </p>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Tipos de Usuários</h3>
                  <div className="grid md:grid-cols-3 gap-4">
                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="pt-6">
                        <Users className="w-8 h-8 text-blue-600 mb-2" />
                        <h4 className="font-bold">Revendedores</h4>
                        <p className="text-sm text-gray-600 mt-2">
                          Compram produtos de fabricantes e gerenciam vendas para clientes finais.
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-green-50 border-green-200">
                      <CardContent className="pt-6">
                        <Package className="w-8 h-8 text-green-600 mb-2" />
                        <h4 className="font-bold">Fabricantes</h4>
                        <p className="text-sm text-gray-600 mt-2">
                          Cadastram produtos e recebem pedidos de compra dos revendedores.
                        </p>
                      </CardContent>
                    </Card>
                    
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="pt-6">
                        <Truck className="w-8 h-8 text-orange-600 mb-2" />
                        <h4 className="font-bold">Transportadoras</h4>
                        <p className="text-sm text-gray-600 mt-2">
                          Gerenciam rotas e oferecem fretes para os revendedores.
                        </p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                <div>
                  <h3 className="font-semibold text-lg mb-3">Stack Tecnológico</h3>
                  <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                    <p><strong>Frontend:</strong> React, Tailwind CSS, shadcn/ui</p>
                    <p><strong>Backend:</strong> Base44 BaaS (Backend as a Service)</p>
                    <p><strong>Banco de Dados:</strong> Base44 Entities (NoSQL)</p>
                    <p><strong>Autenticação:</strong> Base44 Auth (Google OAuth)</p>
                    <p><strong>Funções Backend:</strong> Deno Deploy</p>
                    <p><strong>IA:</strong> Agentes com LLM para atendimento</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* ENTIDADES */}
          <TabsContent value="entidades" className="space-y-4">
            {/* User */}
            <Card>
              <CardHeader className="bg-blue-50">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-blue-600" />
                  User (Usuários)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Entidade principal que armazena todos os usuários do sistema (Admin, Revendedores, Fabricantes e Transportadoras).
                </p>
                
                <h4 className="font-semibold mb-2">Campos Built-in:</h4>
                <div className="bg-gray-50 p-3 rounded mb-4 space-y-1 text-sm">
                  <p><Badge variant="outline">id</Badge> - Identificador único (auto)</p>
                  <p><Badge variant="outline">email</Badge> - Email do usuário (auto)</p>
                  <p><Badge variant="outline">full_name</Badge> - Nome completo (auto)</p>
                  <p><Badge variant="outline">created_date</Badge> - Data de criação (auto)</p>
                  <p><Badge variant="outline">updated_date</Badge> - Última atualização (auto)</p>
                </div>

                <h4 className="font-semibold mb-2">Campos Customizados:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">role</Badge>
                    <span>Enum: 'admin' ou 'user' (default: 'user')</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">tipo_usuario</Badge>
                    <span>Enum: 'fabricante' ou 'transportador' (undefined = revendedor)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>empresa</Badge>
                    <span>Nome da empresa (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cnpj</Badge>
                    <span>CNPJ da empresa (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>endereco</Badge>
                    <span>Endereço completo (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>whatsapp</Badge>
                    <span>Número WhatsApp (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>site</Badge>
                    <span>Website (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>logomarca</Badge>
                    <span>URL da logo (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">aprovado</Badge>
                    <span>Se foi aprovado pelo admin (boolean, default: false)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>historia_empresa</Badge>
                    <span>Descrição da empresa (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>formas_pagamento</Badge>
                    <span>Formas de pagamento (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>prazo_entrega</Badge>
                    <span>Prazo de entrega padrão (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>politica_troca</Badge>
                    <span>Política de trocas (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>instrucoes_agente_ia</Badge>
                    <span>Instruções para agente IA (string, required)</span>
                  </div>
                </div>

                <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded">
                  <p className="text-sm text-yellow-800">
                    <strong>Regra de Segurança:</strong> Apenas admins podem listar, atualizar ou deletar outros usuários. 
                    Usuários comuns só podem ver/editar seu próprio registro.
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Product */}
            <Card>
              <CardHeader className="bg-green-50">
                <CardTitle className="flex items-center gap-2">
                  <Package className="w-5 h-5 text-green-600" />
                  Product (Produtos)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Catálogo de produtos. Podem ser criados por admins ou por fabricantes (pendente aprovação).
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>foto</Badge>
                    <span>URL da foto do produto (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>nome</Badge>
                    <span>Nome do produto (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cod</Badge>
                    <span>Código SKU único (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>peso</Badge>
                    <span>Peso em kg (number)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>dimensoes</Badge>
                    <span>LxAxP em cm (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">und</Badge>
                    <span>Enum: 'peça', 'par', 'kg', 'metro', 'litro', 'caixa' (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">categoria</Badge>
                    <span>Enum: 'Cardiovascular', 'Musculação', etc. (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">ativo</Badge>
                    <span>Se está ativo no catálogo (boolean, default: true)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>fabricante_id</Badge>
                    <span>ID do fabricante que criou (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>fabricante_nome</Badge>
                    <span>Nome do fabricante (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">aprovado_produto</Badge>
                    <span>Se foi aprovado pelo admin (boolean, default: false)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>preco_fabricante</Badge>
                    <span>Preço sugerido pelo fabricante (number)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* SupplierProduct */}
            <Card>
              <CardHeader className="bg-indigo-50">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-indigo-600" />
                  SupplierProduct (Produtos do Revendedor)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Relaciona produtos com revendedores, incluindo preços customizados e disponibilidade.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>supplier_id</Badge>
                    <span>ID do revendedor (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>product_id</Badge>
                    <span>ID do produto (Product.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>preco</Badge>
                    <span>Preço do produto para este revendedor (number)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">disponivel</Badge>
                    <span>Se está disponível (boolean, default: true)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>observacoes</Badge>
                    <span>Observações específicas (string)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Cliente */}
            <Card>
              <CardHeader className="bg-teal-50">
                <CardTitle className="flex items-center gap-2">
                  <Users className="w-5 h-5 text-teal-600" />
                  Cliente (Clientes)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Clientes finais dos revendedores e fabricantes.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>fornecedor_id</Badge>
                    <span>ID do fornecedor dono (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>nome</Badge>
                    <span>Nome do cliente (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cpf_cnpj</Badge>
                    <span>CPF ou CNPJ (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>email</Badge>
                    <span>Email (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>telefone</Badge>
                    <span>Telefone (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>endereco</Badge>
                    <span>Endereço completo (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cidade</Badge>
                    <span>Cidade (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>estado</Badge>
                    <span>Estado (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cep</Badge>
                    <span>CEP (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">ativo</Badge>
                    <span>Se está ativo (boolean, default: true)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Pedido */}
            <Card>
              <CardHeader className="bg-orange-50">
                <CardTitle className="flex items-center gap-2">
                  <FileText className="w-5 h-5 text-orange-600" />
                  Pedido (Orçamentos e Vendas)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Pedidos criados por revendedores/fabricantes para seus clientes.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>fornecedor_id</Badge>
                    <span>ID do fornecedor (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cliente_id</Badge>
                    <span>ID do cliente (Cliente.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cliente_nome</Badge>
                    <span>Nome do cliente (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>numero_pedido</Badge>
                    <span>Número do pedido (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>data_pedido</Badge>
                    <span>Data do pedido (date)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">tipo</Badge>
                    <span>Enum: 'orcamento' ou 'venda' (default: 'orcamento')</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>itens</Badge>
                    <span>Array de objetos (product_id, cod, nome, quantidade, preco_unitario, subtotal)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>subtotal</Badge>
                    <span>Subtotal dos produtos (number)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>frete</Badge>
                    <span>Valor do frete (number, default: 0)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>desconto</Badge>
                    <span>Valor do desconto (number, default: 0)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>total</Badge>
                    <span>Total do pedido (number)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">status</Badge>
                    <span>Enum: 'pendente', 'confirmado', 'em_separacao', 'enviado', 'entregue', 'cancelado'</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* PedidoCompra */}
            <Card>
              <CardHeader className="bg-red-50">
                <CardTitle className="flex items-center gap-2">
                  <ShoppingCart className="w-5 h-5 text-red-600" />
                  PedidoCompra (Pedidos de Compra)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Pedidos de compra que revendedores fazem para fabricantes.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>revendedor_id</Badge>
                    <span>ID do revendedor (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>revendedor_nome</Badge>
                    <span>Nome do revendedor (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>fabricante_id</Badge>
                    <span>ID do fabricante (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>fabricante_nome</Badge>
                    <span>Nome do fabricante (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>venda_id</Badge>
                    <span>ID da venda que originou (Pedido.id)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>itens</Badge>
                    <span>Array de objetos (product_id, cod, nome, quantidade, preco_unitario, subtotal)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>total</Badge>
                    <span>Total (number)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">status</Badge>
                    <span>Enum: 'pendente', 'enviado', 'confirmado', 'em_producao', 'despachado', 'recebido', 'cancelado'</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* TransportadorRota */}
            <Card>
              <CardHeader className="bg-amber-50">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-amber-600" />
                  TransportadorRota (Rotas de Transporte)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Rotas gerenciadas pelas transportadoras.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>transportador_id</Badge>
                    <span>ID da transportadora (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">estado</Badge>
                    <span>Enum: UFs brasileiras (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cidades</Badge>
                    <span>Cidades atendidas (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>periodicidade</Badge>
                    <span>Ex: semanal, quinzenal (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>dias_carregamento</Badge>
                    <span>Dias de carregamento (string)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">ativo</Badge>
                    <span>Se está ativa (boolean, default: true)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* FreightOffer */}
            <Card>
              <CardHeader className="bg-cyan-50">
                <CardTitle className="flex items-center gap-2">
                  <Truck className="w-5 h-5 text-cyan-600" />
                  FreightOffer (Ofertas de Frete)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Ofertas de frete que fornecedores fazem para destinos específicos.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>supplier_id</Badge>
                    <span>ID do fornecedor (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>cidade</Badge>
                    <span>Cidade de destino (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">estado</Badge>
                    <span>Enum: UFs brasileiras (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>peso_total</Badge>
                    <span>Peso em kg (number, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>valor_ofertado</Badge>
                    <span>Valor em R$ (number, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">ativo</Badge>
                    <span>Se está ativa (boolean, default: true)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Notification */}
            <Card>
              <CardHeader className="bg-pink-50">
                <CardTitle className="flex items-center gap-2">
                  <Bell className="w-5 h-5 text-pink-600" />
                  Notification (Notificações)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Sistema de notificações para fornecedores sobre mudanças em produtos.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>supplier_id</Badge>
                    <span>ID do fornecedor que recebe (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">tipo</Badge>
                    <span>Enum: 'novo_produto', 'alteracao_preco', 'produto_aprovado', 'mensagem_placefit' (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>produto_id</Badge>
                    <span>ID do produto relacionado (Product.id)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>fabricante_id</Badge>
                    <span>ID do fabricante que originou (User.id)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>mensagem</Badge>
                    <span>Mensagem (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">lida</Badge>
                    <span>Se foi lida (boolean, default: false)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* AIKnowledge */}
            <Card>
              <CardHeader className="bg-violet-50">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-violet-600" />
                  AIKnowledge (Base de Conhecimento IA)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Base de conhecimento para o agente de IA de cada fabricante/revendedor.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>fabricante_id</Badge>
                    <span>ID do fabricante dono (User.id)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>supplier_id</Badge>
                    <span>ID do revendedor dono (User.id)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>titulo</Badge>
                    <span>Título do conhecimento (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>conteudo</Badge>
                    <span>Conteúdo (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">categoria</Badge>
                    <span>Enum: 'Produtos', 'Fornecedores', 'Frete', 'Políticas', 'FAQ', 'Arquivos', 'Outros' (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-green-100 text-green-800">ativo</Badge>
                    <span>Se está ativo (boolean, default: true)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* ChatHistory */}
            <Card>
              <CardHeader className="bg-slate-50">
                <CardTitle className="flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-slate-600" />
                  ChatHistory (Histórico de Chat)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Histórico de conversas com o agente de IA para análise e melhoria.
                </p>
                
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>fabricante_id</Badge>
                    <span>ID do fabricante dono do agente (User.id) (required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>user_message</Badge>
                    <span>Mensagem do usuário (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>agent_response</Badge>
                    <span>Resposta do agente (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge className="bg-purple-100 text-purple-800">feedback</Badge>
                    <span>Enum: 'pendente', 'aprovado', 'inadequado' (default: 'pendente')</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>correcao</Badge>
                    <span>Resposta corrigida pelo admin (string)</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Category e Unit */}
            <Card>
              <CardHeader className="bg-gray-50">
                <CardTitle className="flex items-center gap-2">
                  <Layers className="w-5 h-5 text-gray-600" />
                  Category e Unit (Categorias e Unidades)
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-6">
                <p className="text-sm text-gray-600 mb-4">
                  Tabelas auxiliares para categorias e unidades de medida customizadas.
                </p>
                
                <h4 className="font-semibold mb-2">Category:</h4>
                <div className="space-y-2 text-sm mb-4">
                  <div className="flex gap-2">
                    <Badge>nome</Badge>
                    <span>Nome da categoria (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>subcategorias</Badge>
                    <span>Array de strings (default: [])</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>ordem</Badge>
                    <span>Ordem de exibição (number, default: 0)</span>
                  </div>
                </div>

                <h4 className="font-semibold mb-2">Unit:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex gap-2">
                    <Badge>nome</Badge>
                    <span>Nome da unidade (string, required)</span>
                  </div>
                  <div className="flex gap-2">
                    <Badge>ordem</Badge>
                    <span>Ordem de exibição (number, default: 0)</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* FLUXOS DE DADOS */}
          <TabsContent value="fluxos" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <ArrowRight className="w-6 h-6 text-blue-600" />
                  Fluxos Principais do Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Fluxo 1 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    1. Cadastro e Aprovação de Usuários
                  </h3>
                  <div className="bg-blue-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600">1</Badge>
                      <p className="text-sm">Usuário faz login com Google OAuth (via Base44 Auth)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600">2</Badge>
                      <p className="text-sm">Sistema cria registro na entidade <strong>User</strong> com aprovado=false</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600">3</Badge>
                      <p className="text-sm">Usuário preenche dados (empresa, CNPJ, tipo_usuario, etc.)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600">4</Badge>
                      <p className="text-sm">Admin acessa página <strong>Usuários</strong> e aprova o usuário (aprovado=true)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-blue-600">5</Badge>
                      <p className="text-sm">Usuário aprovado passa a ter acesso completo ao sistema</p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 2 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    2. Gestão de Produtos (Admin e Fabricantes)
                  </h3>
                  <div className="bg-green-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">1</Badge>
                      <p className="text-sm">Admin cria produtos na página <strong>Products</strong> (aprovado_produto=true automaticamente)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">2</Badge>
                      <p className="text-sm">Fabricante cria produtos na página <strong>FabricanteProdutos</strong> (aprovado_produto=false)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">3</Badge>
                      <p className="text-sm">Admin revisa produtos pendentes na página <strong>Products</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">4</Badge>
                      <p className="text-sm">Admin aprova (aprovado_produto=true) e produto entra no catálogo geral</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-green-600">5</Badge>
                      <p className="text-sm">Sistema cria <strong>Notification</strong> para revendedores sobre novos produtos</p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 3 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    3. Revendedor Adiciona Produtos à Sua Tabela
                  </h3>
                  <div className="bg-indigo-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-indigo-600">1</Badge>
                      <p className="text-sm">Revendedor acessa <strong>Catálogo</strong> e visualiza produtos aprovados</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-indigo-600">2</Badge>
                      <p className="text-sm">Revendedor adiciona produto à sua tabela, definindo preço</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-indigo-600">3</Badge>
                      <p className="text-sm">Sistema cria registro em <strong>SupplierProduct</strong> (supplier_id + product_id + preco)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-indigo-600">4</Badge>
                      <p className="text-sm">Produto aparece em <strong>Meus Produtos</strong> do revendedor</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-indigo-600">5</Badge>
                      <p className="text-sm">Revendedor pode exportar sua tabela em <strong>Sua Tabela</strong> (PDF)</p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 4 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    4. Criação de Orçamento e Conversão em Venda
                  </h3>
                  <div className="bg-orange-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">1</Badge>
                      <p className="text-sm">Revendedor/Fabricante acessa <strong>Orçamentos</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">2</Badge>
                      <p className="text-sm">Seleciona <strong>Cliente</strong> (ou cria novo)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">3</Badge>
                      <p className="text-sm">Adiciona produtos de <strong>Meus Produtos</strong> ao orçamento</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">4</Badge>
                      <p className="text-sm">Sistema calcula subtotal, aplica frete/desconto, gera total</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">5</Badge>
                      <p className="text-sm">Cria registro em <strong>Pedido</strong> com tipo='orcamento'</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">6</Badge>
                      <p className="text-sm">Ao confirmar venda, muda tipo='venda' e status='confirmado'</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-orange-600">7</Badge>
                      <p className="text-sm">Venda aparece na página <strong>Vendas</strong></p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 5 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    5. Pedido de Compra do Revendedor ao Fabricante
                  </h3>
                  <div className="bg-red-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-600">1</Badge>
                      <p className="text-sm">Revendedor confirma venda para cliente final (Pedido tipo='venda')</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-600">2</Badge>
                      <p className="text-sm">Sistema agrupa produtos por fabricante</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-600">3</Badge>
                      <p className="text-sm">Para cada fabricante, cria <strong>PedidoCompra</strong> com:</p>
                    </div>
                    <div className="ml-12 space-y-1 text-sm text-gray-700">
                      <p>• revendedor_id (quem está comprando)</p>
                      <p>• fabricante_id (quem vai receber)</p>
                      <p>• venda_id (origem do pedido)</p>
                      <p>• itens, total, status='pendente'</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-600">4</Badge>
                      <p className="text-sm">Fabricante vê pedido em <strong>PedidosCompraFabricante</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-600">5</Badge>
                      <p className="text-sm">Fabricante atualiza status (confirmado → em_producao → despachado)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-red-600">6</Badge>
                      <p className="text-sm">Revendedor acompanha em <strong>PedidosCompra</strong></p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 6 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    6. Gestão de Frete
                  </h3>
                  <div className="bg-amber-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-600">1</Badge>
                      <p className="text-sm">Transportadora cadastra rotas em <strong>TransportadorRotas</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-600">2</Badge>
                      <p className="text-sm">Revendedor/Fabricante cria ofertas de frete em <strong>FreightOffer</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-600">3</Badge>
                      <p className="text-sm">Define: cidade, estado, peso_total, valor_ofertado</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-600">4</Badge>
                      <p className="text-sm">Ao criar orçamento, sistema consulta <strong>FreightOffer</strong> por destino</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-amber-600">5</Badge>
                      <p className="text-sm">Aplica valor de frete ao Pedido</p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 7 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    7. Sistema de Notificações
                  </h3>
                  <div className="bg-pink-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-pink-600">1</Badge>
                      <p className="text-sm">Evento ocorre: novo produto, mudança de preço, aprovação</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-pink-600">2</Badge>
                      <p className="text-sm">Sistema cria registros em <strong>Notification</strong> para fornecedores impactados</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-pink-600">3</Badge>
                      <p className="text-sm">Notificação aparece no menu lateral com badge de contador</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-pink-600">4</Badge>
                      <p className="text-sm">Usuário acessa <strong>Notifications</strong> e marca como lida</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-pink-600">5</Badge>
                      <p className="text-sm">Badge é atualizado em tempo real</p>
                    </div>
                  </div>
                </div>

                {/* Fluxo 8 */}
                <div>
                  <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                    8. Atendente IA (Agente Inteligente)
                  </h3>
                  <div className="bg-violet-50 p-4 rounded-lg space-y-3">
                    <div className="flex items-center gap-3">
                      <Badge className="bg-violet-600">1</Badge>
                      <p className="text-sm">Fabricante/Revendedor alimenta <strong>AIKnowledge</strong> com informações</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-violet-600">2</Badge>
                      <p className="text-sm">Cliente ou revendedor abre chat em <strong>FabricantesRevendedor</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-violet-600">3</Badge>
                      <p className="text-sm">Sistema busca:</p>
                    </div>
                    <div className="ml-12 space-y-1 text-sm text-gray-700">
                      <p>• Produtos do fabricante (Product)</p>
                      <p>• Base de conhecimento (AIKnowledge)</p>
                      <p>• Histórico de conversas (ChatHistory)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-violet-600">4</Badge>
                      <p className="text-sm">Envia para LLM via integração <strong>Core.InvokeLLM</strong></p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-violet-600">5</Badge>
                      <p className="text-sm">Resposta é salva em <strong>ChatHistory</strong> para análise</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <Badge className="bg-violet-600">6</Badge>
                      <p className="text-sm">Admin pode revisar conversas e corrigir respostas inadequadas</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* INTEGRAÇÕES */}
          <TabsContent value="integracao" className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Database className="w-6 h-6 text-blue-600" />
                  Integrações e Backend Functions
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div>
                  <h3 className="font-bold text-lg mb-3">Backend Functions (Deno Deploy)</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Funções serverless que estendem a lógica de negócio e fazem chamadas privilegiadas ao banco.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge>getFabricantes.js</Badge>
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Busca todos os fabricantes aprovados usando service role (acesso elevado independente do usuário logado).
                      </p>
                    </div>

                    <div className="bg-gray-50 p-3 rounded-lg">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge>getFabricanteProducts.js</Badge>
                      </h4>
                      <p className="text-sm text-gray-600 mt-1">
                        Retorna produtos de um fabricante específico usando service role.
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-3">Core Integrations (Base44)</h3>
                  <p className="text-sm text-gray-600 mb-4">
                    Integrações nativas da plataforma Base44 disponíveis via SDK.
                  </p>
                  
                  <div className="space-y-3">
                    <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-blue-600">Core.InvokeLLM</Badge>
                      </h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Invoca Large Language Model (IA) para gerar respostas do atendente virtual.
                        Aceita prompt, contexto da internet, JSON schema de resposta e anexos.
                      </p>
                    </div>

                    <div className="bg-green-50 p-3 rounded-lg border border-green-200">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-green-600">Core.SendEmail</Badge>
                      </h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Envia emails transacionais (notificações, confirmações, etc).
                      </p>
                    </div>

                    <div className="bg-purple-50 p-3 rounded-lg border border-purple-200">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-purple-600">Core.UploadFile</Badge>
                      </h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Upload de arquivos (fotos de produtos, logos, documentos). Retorna URL público.
                      </p>
                    </div>

                    <div className="bg-orange-50 p-3 rounded-lg border border-orange-200">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-orange-600">Core.GenerateImage</Badge>
                      </h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Geração de imagens com IA (usado potencialmente para mockups de produtos).
                      </p>
                    </div>

                    <div className="bg-red-50 p-3 rounded-lg border border-red-200">
                      <h4 className="font-semibold flex items-center gap-2">
                        <Badge className="bg-red-600">Core.ExtractDataFromUploadedFile</Badge>
                      </h4>
                      <p className="text-sm text-gray-700 mt-1">
                        Extração de dados de arquivos CSV/Excel (importação de clientes em massa).
                      </p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-3">Autenticação e Autorização</h3>
                  <div className="bg-indigo-50 p-4 rounded-lg border border-indigo-200">
                    <h4 className="font-semibold mb-2">Base44 Auth</h4>
                    <div className="space-y-2 text-sm">
                      <p>• <strong>Google OAuth:</strong> Login via conta Google</p>
                      <p>• <strong>base44.auth.me():</strong> Retorna usuário atual</p>
                      <p>• <strong>base44.auth.updateMe():</strong> Atualiza dados do usuário logado</p>
                      <p>• <strong>base44.auth.logout():</strong> Desloga usuário</p>
                      <p>• <strong>base44.users.inviteUser():</strong> Convida novos usuários</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-3">Segurança de Acesso</h3>
                  <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
                    <h4 className="font-semibold mb-2">Regras de Segurança (x-security)</h4>
                    <div className="space-y-2 text-sm">
                      <p>• <strong>User:</strong> Apenas admins listam/editam/deletam outros usuários. Usuários comuns só veem/editam a si mesmos.</p>
                      <p>• <strong>Outras Entidades:</strong> Maioria é "public" (acesso controlado por lógica de aplicação, não por regras de entidade)</p>
                      <p>• <strong>Service Role:</strong> Backend functions usam <code>base44.asServiceRole</code> para acesso elevado ao banco</p>
                    </div>
                  </div>
                </div>

                <div>
                  <h3 className="font-bold text-lg mb-3">Bibliotecas Frontend</h3>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="grid md:grid-cols-2 gap-2 text-sm">
                      <p>• <strong>React Query:</strong> Cache e estado de queries</p>
                      <p>• <strong>React Hook Form:</strong> Gerenciamento de formulários</p>
                      <p>• <strong>shadcn/ui:</strong> Componentes UI</p>
                      <p>• <strong>Tailwind CSS:</strong> Estilização</p>
                      <p>• <strong>Lucide React:</strong> Ícones</p>
                      <p>• <strong>jsPDF:</strong> Geração de PDFs</p>
                      <p>• <strong>Framer Motion:</strong> Animações</p>
                      <p>• <strong>React Router:</strong> Navegação</p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Diagrama de Relacionamentos</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="bg-slate-50 p-6 rounded-lg border-2 border-slate-200">
                  <pre className="text-xs font-mono overflow-x-auto">
{`
┌─────────────────┐
│      User       │ (Admin, Revendedor, Fabricante, Transportadora)
└────────┬────────┘
         │
         │ (1:N)
         ├───────────────────────────────────────┐
         │                                       │
         ▼                                       ▼
┌─────────────────┐                    ┌─────────────────┐
│    Product      │◄───────────────────│SupplierProduct  │
│ (Catálogo Geral)│     (N:N)          │ (Tabela Preço)  │
└─────────────────┘                    └─────────────────┘
         │                                       │
         │                                       │ (supplier_id)
         ▼                                       ▼
┌─────────────────┐                    ┌─────────────────┐
│   AIKnowledge   │                    │    Cliente      │
│ (Base IA)       │                    └────────┬────────┘
└─────────────────┘                             │
         │                                       │ (1:N)
         │ (fabricante_id)                      ▼
         ▼                              ┌─────────────────┐
┌─────────────────┐                    │     Pedido      │
│  ChatHistory    │                    │ (Orçam/Venda)   │
└─────────────────┘                    └────────┬────────┘
                                                │
                                                │ (venda_id)
                                                ▼
                                       ┌─────────────────┐
                                       │  PedidoCompra   │
                                       │ (Revend→Fabric) │
                                       └─────────────────┘

┌─────────────────┐                    ┌─────────────────┐
│ TransportadorRota│                   │  FreightOffer   │
│ (Rotas Transp)  │                    │ (Ofertas Frete) │
└─────────────────┘                    └─────────────────┘
         │                                       │
         └───────────────┬───────────────────────┘
                         │
                         ▼
                  (Usado no cálculo de frete dos Pedidos)

┌─────────────────┐
│  Notification   │ (Avisos para fornecedores)
└─────────────────┘
         │
         │ (supplier_id, fabricante_id, produto_id)
         └──► Links para User e Product
`}
                  </pre>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        {/* Footer */}
        <Card className="bg-gradient-to-r from-blue-600 to-green-600 text-white">
          <CardContent className="pt-6">
            <div className="text-center space-y-2">
              <p className="font-semibold">PlaceFit - Plataforma B2B para Fitness</p>
              <p className="text-sm opacity-90">Documentação Técnica v1.0 - Fevereiro 2026</p>
              <p className="text-xs opacity-75">Construído com Base44, React e Deno</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}