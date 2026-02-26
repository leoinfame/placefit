import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

// Service Account do Google Cloud
const SERVICE_ACCOUNT = {
  "type": "service_account",
  "project_id": "placefit-ucp",
  "private_key_id": "24b313709037a8f7cd6c64f040196c011f0f200e",
  "private_key": "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQDhiKQ1Votg5HjQ\n3woFq950FF/CnMX9z3NgDg0wfmwBVOhiJ6mLPLBhW6zUu6vcjKP0pxkuF01LLzCL\nd0d8Ixyjl+bBaNd5Xxczf/Qk0EyX/P3WFJKpZb2UjUiuMbe2MHuHoBjGVq/pN349\nlEwzMnJHc5bPX71MkNN5z5XVtKbvkgvAZqddZy9RsqBMOiDCC6lFsG1qWLez1+2M\njYzO4DvkVH0x3qhM91es6dxUu1HWvOgw1DBulKvOjyJdc/BVdLm10gJfezlDxLbI\nhTXgGaj2lWxiA+Nvtaw/qeiqNCM3TmeRl85WcKXPstZYoZJC9xEwLfYtRlCz20y2\n7P5k0gLRAgMBAAECggEABQR3MsCUJTmv/mWX4XxrXIW/g6LdPMJKvM5TOMr3OChd\nayGawgA9pEzX0XvDXQq78wtsofveuld4awHiUz6sum78sTzV3lthNsIX+mGv8oms\nVADtKlubFhz2ivmMLr9xYBkNtAvlqfiUFGaiM1lh9Xj61+43Vea67bDSkoiMVjQM\n4dXfS2G/DWCjEY+xzsXD0V4u0fI7GnDhet3kcu24K5cJF7v0P5/+KAktiEPXdkRN\neIpE80DNsLuEv2FTv0CdqFivQam8Ld5OhDoUmumBl8VKuDC4taMP6lBsh+N3eZre\nX57xhGsYlgAb6ovLEXRckek/GLdSfi7rg7sSn2ICKQKBgQDxxsoUhS8UZQnhW8ry\nXED2i4uZZm0oKmLYjpg9snnpNWE3l4FWCyTY/iae0rErrwkoaiVsvFvmLtydl2YP\nJEC7rZOd5+xnVM12vceHNJUfKLGMQfvXywanY3b3P0M3VW46nVdUWeOoWRSsqG/w\n+CMqYOPeLpayVt531Z3MqcEVwwKBgQDuzTt0Eq5fNFoBoDwFlJJobqSenYvb+SGE\ntQai5TyxRK+6Z/bIrIjJ08CBu2O+isW0ZAz3ZsOrBEUL0JN52P8oWrUoAWRbTxmY\nyxM4gQHQ3eNwMbAYktB1V7/2oV9MnbBruhQHnlSgkCGDeMK6tVTGdF6itkW0ktGw\n8mnSIjK32wKBgAhmdLzzx6f4vrgivVFgXS1zubzxrxc3KcoGYkm6ervci+0niWnY\n50XWxra78UXoRfQug/BcNwEvXaDoErax9sHOjRNubGtGqgDXJSiQbiHwAwMxg7OC\nrU+BiC+c9hPlFvhYYSFgIiXGOo6pJ4KCzI37Yc9lZPz7Qa1+MYZb24aLAoGBAJ6R\nzU7QMNWrL7Ews2qJM4cBIXLp7rsM/ULf6h401k5n68B91JOAbfyHDaeXxS37fDjC\nzxFhPcDLvwWPZL5eZ2BmizCbbAZtyfN5tbOphokpLiOL+wD2TFH/CMs+cMexVjrS\nfwZoDo3n5zkj8TqFultlXonxOuwjKfazoa0VZFRNAoGAes7aB/QEDUoaYWng1/PP\nSy4mNuNKdv+ITQYrPZJTOkVjdvP5njqNs90I2Er/hLpm0RgJbuQkuoaul49ZfG2V\n5hvfcgwCMOqHB1H7I4u1IC6hj/5pAcbEjeO5geAvSABVxuvrtQQbbeKQdfpQ42CW\nVa7hJCJmA81LUaEiCzzF2Mk=\n-----END PRIVATE KEY-----\n",
  "client_email": "placefit-sync@placefit-ucp.iam.gserviceaccount.com",
  "client_id": "109314586600083031456",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  "auth_provider_x509_cert_url": "https://www.googleapis.com/oauth2/v1/certs",
  "client_x509_cert_url": "https://www.googleapis.com/robot/v1/metadata/x509/placefit-sync%40placefit-ucp.iam.gserviceaccount.com",
  "universe_domain": "googleapis.com"
};

const MERCHANT_ID = "573026965"; // ID da conta Merchant Center

// Gerar JWT para autenticação Google
async function createJWT() {
  const header = {
    alg: "RS256",
    typ: "JWT"
  };

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: SERVICE_ACCOUNT.client_email,
    scope: "https://www.googleapis.com/auth/content",
    aud: SERVICE_ACCOUNT.token_uri,
    exp: now + 3600,
    iat: now
  };

  const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  const signatureInput = `${encodedHeader}.${encodedPayload}`;

  // Importar chave privada
  const pemKey = SERVICE_ACCOUNT.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, '')
    .replace(/-----END PRIVATE KEY-----/, '')
    .replace(/\s/g, '');
  
  const binaryKey = Uint8Array.from(atob(pemKey), c => c.charCodeAt(0));
  
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signature = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5",
    cryptoKey,
    new TextEncoder().encode(signatureInput)
  );

  const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
    .replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');

  return `${signatureInput}.${encodedSignature}`;
}

// Obter Access Token do Google
async function getAccessToken() {
  const jwt = await createJWT();
  
  const response = await fetch(SERVICE_ACCOUNT.token_uri, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`
  });

  const data = await response.json();
  return data.access_token;
}

// Calcular frete baseado no estado
async function calculateShipping(base44, supplierState) {
  try {
    const rotas = await base44.asServiceRole.entities.TransportadorRota.filter({
      estado: supplierState,
      ativo: true
    });

    if (rotas.length > 0) {
      // Retorna a primeira rota ativa encontrada
      return {
        price: { value: "50.00", currency: "BRL" },
        service: "Frete Padrão"
      };
    }

    return {
      price: { value: "0.00", currency: "BRL" },
      service: "Frete a calcular"
    };
  } catch (error) {
    console.error("Erro ao calcular frete:", error);
    return {
      price: { value: "0.00", currency: "BRL" },
      service: "Frete a calcular"
    };
  }
}

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    const { event, data, old_data } = await req.json();

    console.log("Evento recebido:", event.type, "| Entity ID:", event.entity_id);

    // Verificar se é update e se campos relevantes mudaram
    if (event.type !== 'update') {
      return Response.json({ message: "Evento ignorado (não é update)" });
    }

    const precoMudou = old_data?.preco !== data?.preco;
    const disponivelMudou = old_data?.disponivel !== data?.disponivel;

    if (!precoMudou && !disponivelMudou) {
      return Response.json({ message: "Campos monitorados não foram alterados" });
    }

    // Buscar produto relacionado
    const product = await base44.asServiceRole.entities.Product.get(data.product_id);
    if (!product) {
      return Response.json({ error: "Produto não encontrado" }, { status: 404 });
    }

    // Buscar dados do fornecedor
    const supplier = await base44.asServiceRole.entities.User.get(data.supplier_id);
    if (!supplier) {
      return Response.json({ error: "Fornecedor não encontrado" }, { status: 404 });
    }

    // Calcular frete
    const shipping = await calculateShipping(base44, supplier.estado);

    // Montar payload para Google Content API
    const productPayload = {
      offerId: event.entity_id,
      contentLanguage: "pt",
      targetCountry: "BR",
      channel: "online",
      title: product.nome,
      description: product.nome,
      link: data.ucp_checkout_url || `https://placefit.com/produto/${product.id}`,
      imageLink: product.foto || "https://via.placeholder.com/300",
      availability: data.disponivel ? "in stock" : "out of stock",
      price: {
        value: data.sale_price || data.preco,
        currency: "BRL"
      },
      brand: product.fabricante_nome || "PlaceFit",
      condition: "new",
      itemGroupId: product.cod,
      shipping: [{
        country: "BR",
        price: shipping.price,
        service: shipping.service
      }]
    };

    // Adicionar GTIN se disponível
    if (product.gtin) {
      productPayload.gtin = product.gtin;
    }

    // Adicionar categoria do Google se disponível
    if (product.google_category) {
      productPayload.googleProductCategory = product.google_category;
    }

    // Obter token de acesso
    const accessToken = await getAccessToken();

    // Enviar para Google Merchant Center
    const apiUrl = `https://shoppingcontent.googleapis.com/content/v2.1/${MERCHANT_ID}/products`;
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(productPayload)
    });

    const result = await response.json();

    if (!response.ok) {
      console.error("Erro da API do Google:", result);
      return Response.json({ 
        error: "Falha ao sincronizar com Google Merchant Center",
        details: result
      }, { status: response.status });
    }

    console.log("✓ Produto sincronizado com sucesso:", event.entity_id);

    return Response.json({ 
      success: true,
      offerId: event.entity_id,
      googleResponse: result
    });

  } catch (error) {
    console.error("Erro na função:", error);
    return Response.json({ 
      error: error.message,
      stack: error.stack
    }, { status: 500 });
  }
});