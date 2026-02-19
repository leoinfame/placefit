import React, { useState, useEffect } from "react";
import { base44 } from "@/api/base44Client";
import { Users, Search, Mail, Phone, Calendar, Eye, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

export default function Clientes() {
  const [user, setUser] = useState(null);
  const [clientes, setClientes] = useState([]);
  const [filteredClientes, setFilteredClientes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    filterClientes();
  }, [clientes, searchTerm]);

  const loadData = async () => {
    try {
      const currentUser = await base44.auth.me();
      setUser(currentUser);

      if (currentUser.role !== 'admin') {
        window.location.href = '/Dashboard';
        return;
      }

      // Carregar todos os usuários
      const allUsers = await base44.entities.User.list('-created_date');
      
      // Filtrar clientes: usuários que visitaram o marketplace (têm ultima_visita_marketplace) 
      // OU que não são admin nem fornecedores aprovados
      const clientesData = allUsers.filter(u => {
        // Excluir admins
        if (u.role === 'admin') return false;
        
        // Excluir fornecedores aprovados
        if (u.role === 'user' && u.aprovado) return false;
        
        // Incluir qualquer usuário que tenha visitado o marketplace
        if (u.ultima_visita_marketplace) return true;
        
        // Incluir usuários que não são fornecedores
        return u.role !== 'user';
      });
      
      console.log("Total de usuários:", allUsers.length);
      console.log("Clientes identificados:", clientesData.length);
      
      setClientes(clientesData);
    } catch (error) {
      console.error("Erro ao carregar clientes:", error);
    }
    setLoading(false);
  };

  const filterClientes = () => {
    let filtered = clientes;
    
    if (searchTerm) {
      filtered = filtered.filter(cliente =>
        (cliente.full_name?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cliente.email?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (cliente.whatsapp || '').includes(searchTerm)
      );
    }
    
    setFilteredClientes(filtered);
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Nunca';
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const exportToCSV = () => {
    const headers = ['Nome', 'E-mail', 'WhatsApp', 'Data de Cadastro', 'Última Visita'];
    const csvData = filteredClientes.map(cliente => [
      cliente.full_name || '',
      cliente.email || '',
      cliente.whatsapp || '',
      formatDate(cliente.created_date),
      formatDate(cliente.ultima_visita_marketplace)
    ]);

    const csvContent = [
      headers.join(','),
      ...csvData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `clientes_marketplace_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-gray-200 rounded w-1/3"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 min-h-screen">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Clientes do Marketplace</h1>
            <p className="text-gray-600">Visualize e gerencie todos os clientes cadastrados</p>
          </div>
          <Button
            onClick={exportToCSV}
            disabled={filteredClientes.length === 0}
            className="bg-gradient-to-r from-blue-600 to-green-600 hover:from-blue-700 hover:to-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar CSV
          </Button>
        </div>

        {/* Estatísticas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-gradient-to-br from-blue-50 to-blue-100 border-blue-200 border">
            <CardContent className="p-4 text-center">
              <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-blue-900">{clientes.length}</div>
              <p className="text-sm text-blue-700">Total de Clientes</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-50 to-green-100 border-green-200 border">
            <CardContent className="p-4 text-center">
              <Mail className="w-8 h-8 text-green-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-green-900">
                {clientes.filter(c => c.email).length}
              </div>
              <p className="text-sm text-green-700">Com E-mail</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-purple-100 border-purple-200 border">
            <CardContent className="p-4 text-center">
              <Phone className="w-8 h-8 text-purple-600 mx-auto mb-2" />
              <div className="text-2xl font-bold text-purple-900">
                {clientes.filter(c => c.whatsapp).length}
              </div>
              <p className="text-sm text-purple-700">Com WhatsApp</p>
            </CardContent>
          </Card>
        </div>

        {/* Filtro */}
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-gray-400" />
              <Input
                placeholder="Buscar por nome, e-mail ou telefone..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 bg-white/80 border-gray-200"
              />
            </div>
          </div>
        </div>

        {/* Tabela de Clientes */}
        <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              Lista de Clientes ({filteredClientes.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {filteredClientes.length === 0 ? (
              <div className="text-center py-12">
                <Users className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">Nenhum cliente encontrado</h3>
                <p className="text-gray-600">Os clientes aparecerão aqui quando acessarem o marketplace.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead>Data de Cadastro</TableHead>
                      <TableHead>Última Visita</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredClientes.map((cliente) => (
                      <TableRow key={cliente.id} className="hover:bg-blue-50">
                        <TableCell className="font-medium">
                          {cliente.full_name || 'Não informado'}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Mail className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{cliente.email || 'Não informado'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-gray-400" />
                            <span className="text-sm">{cliente.whatsapp || 'Não informado'}</span>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm text-gray-600">
                            <Calendar className="w-4 h-4" />
                            {formatDate(cliente.created_date)}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2 text-sm">
                            <Eye className="w-4 h-4 text-gray-400" />
                            {cliente.ultima_visita_marketplace ? (
                              <span className="text-gray-600">
                                {formatDate(cliente.ultima_visita_marketplace)}
                              </span>
                            ) : (
                              <Badge variant="secondary" className="text-xs">
                                Nunca acessou
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}