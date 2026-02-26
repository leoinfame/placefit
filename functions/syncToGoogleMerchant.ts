import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { event, data, old_data } = await req.json();

        // Verificar se houve mudança em preço ou disponibilidade
        if (event.type !== 'update') {
            return Response.json({ message: 'Evento ignorado - apenas updates são processados' });
        }

        const priceChanged = old_data?.preco !== data?.preco;
        const availabilityChanged = old_data?.disponivel !== data?.disponivel;

        if (!priceChanged && !availabilityChanged) {
            return Response.json({ message: 'Sem alterações em preço ou disponibilidade' });
        }

        // Buscar dados do produto
        const product = await base44.asServiceRole.entities.Product.get(data.product_id);
        if (!product) {
            return Response.json({ error: 'Produto não encontrado' }, { status: 404 });
        }

        // Buscar dados do revendedor
        const supplier = await base44.asServiceRole.entities.User.get(data.supplier_id);
        if (!supplier) {
            return Response.json({ error: 'Revendedor não encontrado' }, { status: 404 });
        }

        // Buscar rotas de frete para calcular shipping
        const rotasFrete = await base44.asServiceRole.entities.TransportadorRota.filter({
            estado: supplier.estado
        });

        // Calcular frete (exemplo simplificado - você pode ajustar a lógica)
        let shippingCost = 0;
        if (rotasFrete.length > 0 && product.peso) {
            // Lógica de exemplo: R$ 10 por kg
            shippingCost = product.peso * 10;
        }

        // Montar payload para Google Content API v2.1
        const googleProduct = {
            offerId: data.id,
            itemGroupId: product.cod,
            title: product.nome,
            description: product.fabricante_nome ? `${product.nome} - ${product.fabricante_nome}` : product.nome,
            link: data.ucp_checkout_url || `https://placefit.com/produto/${product.id}`,
            imageLink: product.foto || '',
            availability: data.disponivel ? 'in stock' : 'out of stock',
            price: {
                value: data.preco?.toString() || '0',
                currency: 'BRL'
            },
            brand: product.fabricante_nome || 'PlaceFit',
            condition: 'new',
            shipping: [{
                country: 'BR',
                price: {
                    value: shippingCost.toString(),
                    currency: 'BRL'
                }
            }],
            shippingLabel: data.shipping_label || supplier.estado || 'default'
        };

        // Adicionar GTIN e categoria do Google se disponíveis
        if (product.gtin) {
            googleProduct.gtin = product.gtin;
        }
        if (product.google_category) {
            googleProduct.googleProductCategory = product.google_category;
        }

        // Sale price se houver promoção
        if (data.sale_price && data.sale_price < data.preco) {
            googleProduct.salePrice = {
                value: data.sale_price.toString(),
                currency: 'BRL'
            };
        }

        // Verificar secrets necessárias
        const merchantId = Deno.env.get("GOOGLE_MERCHANT_ID");
        const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

        if (!merchantId || !serviceAccountJson) {
            console.warn('GOOGLE_MERCHANT_ID ou GOOGLE_SERVICE_ACCOUNT_JSON não configurados');
            return Response.json({ 
                warning: 'Credenciais do Google não configuradas - produto preparado mas não enviado',
                product: googleProduct 
            });
        }

        // Obter access token do Google usando Service Account
        const credentials = JSON.parse(serviceAccountJson);
        const jwt = await createGoogleJWT(credentials);
        const tokenResponse = await fetch('https://oauth2.googleapis.com/token', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
                assertion: jwt
            })
        });
        const tokenData = await tokenResponse.json();
        const accessToken = tokenData.access_token;

        // Enviar para Google Merchant Center
        const googleResponse = await fetch(
            `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/products`,
            {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(googleProduct)
            }
        );

        if (!googleResponse.ok) {
            const errorData = await googleResponse.text();
            console.error('Erro ao enviar para Google:', errorData);
            return Response.json({ 
                error: 'Falha ao enviar para Google Merchant Center',
                details: errorData 
            }, { status: 500 });
        }

        const result = await googleResponse.json();

        return Response.json({ 
            success: true,
            message: 'Produto sincronizado com Google Merchant Center',
            googleProductId: result.id,
            changes: {
                priceChanged,
                availabilityChanged
            }
        });

    } catch (error) {
        console.error('Erro na sincronização:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

// Função auxiliar para criar JWT do Google (Service Account)
async function createGoogleJWT(credentials) {
    const header = {
        alg: 'RS256',
        typ: 'JWT'
    };

    const now = Math.floor(Date.now() / 1000);
    const payload = {
        iss: credentials.client_email,
        scope: 'https://www.googleapis.com/auth/content',
        aud: 'https://oauth2.googleapis.com/token',
        exp: now + 3600,
        iat: now
    };

    const encodedHeader = btoa(JSON.stringify(header)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const encodedPayload = btoa(JSON.stringify(payload)).replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
    const signatureInput = `${encodedHeader}.${encodedPayload}`;

    // Importar chave privada
    const privateKey = await crypto.subtle.importKey(
        'pkcs8',
        pemToArrayBuffer(credentials.private_key),
        {
            name: 'RSASSA-PKCS1-v1_5',
            hash: 'SHA-256'
        },
        false,
        ['sign']
    );

    // Assinar
    const signature = await crypto.subtle.sign(
        'RSASSA-PKCS1-v1_5',
        privateKey,
        new TextEncoder().encode(signatureInput)
    );

    const encodedSignature = btoa(String.fromCharCode(...new Uint8Array(signature)))
        .replace(/=/g, '')
        .replace(/\+/g, '-')
        .replace(/\//g, '_');

    return `${signatureInput}.${encodedSignature}`;
}

function pemToArrayBuffer(pem) {
    const b64 = pem
        .replace(/-----BEGIN PRIVATE KEY-----/, '')
        .replace(/-----END PRIVATE KEY-----/, '')
        .replace(/\s/g, '');
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}