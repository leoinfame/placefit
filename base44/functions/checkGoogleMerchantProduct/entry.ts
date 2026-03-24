import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
    try {
        const base44 = createClientFromRequest(req);
        const { productId } = await req.json();

        if (!productId) {
            return Response.json({ error: 'productId é obrigatório' }, { status: 400 });
        }

        // Verificar secrets necessárias
        const merchantId = Deno.env.get("GOOGLE_MERCHANT_ID");
        const serviceAccountJson = Deno.env.get("GOOGLE_SERVICE_ACCOUNT_JSON");

        if (!merchantId || !serviceAccountJson) {
            return Response.json({ 
                error: 'GOOGLE_MERCHANT_ID ou GOOGLE_SERVICE_ACCOUNT_JSON não configurados'
            }, { status: 500 });
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

        // Buscar produto no Google Merchant Center
        const googleResponse = await fetch(
            `https://shoppingcontent.googleapis.com/content/v2.1/${merchantId}/products/${productId}`,
            {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'application/json'
                }
            }
        );

        if (!googleResponse.ok) {
            const errorData = await googleResponse.text();
            console.error('Erro ao buscar produto no Google:', errorData);
            return Response.json({ 
                error: 'Produto não encontrado no Google Merchant Center',
                details: errorData 
            }, { status: googleResponse.status });
        }

        const product = await googleResponse.json();

        // Auditar dados do produto
        const audit = {
            productId: product.id,
            title: product.title,
            status: determineStatus(product),
            itemLevelIssues: product.issues || [],
            hasIssues: (product.issues && product.issues.length > 0),
            imageAccessible: !!product.imageLink,
            imageLink: product.imageLink,
            linkAccessible: !!product.link,
            link: product.link,
            price: product.price,
            availability: product.availability,
            brand: product.brand,
            gtin: product.gtin || 'Não informado',
            googleProductCategory: product.googleProductCategory || 'Não informado',
            rawData: product
        };

        // Verificar acessibilidade da imagem e link
        const accessibilityChecks = await Promise.allSettled([
            checkUrlAccessibility(product.imageLink, 'Imagem'),
            checkUrlAccessibility(product.link, 'Link do produto')
        ]);

        audit.imageAccessibilityCheck = accessibilityChecks[0];
        audit.linkAccessibilityCheck = accessibilityChecks[1];

        return Response.json({ 
            success: true,
            audit 
        });

    } catch (error) {
        console.error('Erro na auditoria:', error);
        return Response.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
});

// Determina o status do produto baseado nos issues
function determineStatus(product) {
    if (!product.issues || product.issues.length === 0) {
        return 'approved';
    }

    const hasBlockingIssues = product.issues.some(issue => 
        issue.severity === 'error' || issue.servability === 'disapproved'
    );

    if (hasBlockingIssues) {
        return 'disapproved';
    }

    return 'pending';
}

// Verifica se uma URL está acessível
async function checkUrlAccessibility(url, description) {
    if (!url) {
        return {
            status: 'error',
            message: `${description} não informada`,
            accessible: false
        };
    }

    try {
        const response = await fetch(url, { method: 'HEAD' });
        return {
            status: response.ok ? 'success' : 'error',
            statusCode: response.status,
            message: response.ok ? `${description} acessível` : `${description} retornou status ${response.status}`,
            accessible: response.ok
        };
    } catch (error) {
        return {
            status: 'error',
            message: `Erro ao acessar ${description}: ${error.message}`,
            accessible: false
        };
    }
}

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