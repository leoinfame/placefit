// TEMPORARIA (10/10/2026) -- apagar depois de usada.
// Rehospeda no app as fotos de ProductTemplate que estavam como hotlink de sites
// de terceiros (AHB, Haxfit, Metal Forma, Irroba/Anilhas de Ferro, placefit.com.br).
// As imagens chegam no corpo do POST, baixadas antes pelo admin; so entra arquivo
// cujo SHA-256 esta na lista fixa abaixo. Nao altera nenhum ProductTemplate.
//
// GET  ?info=1                         -> build e quantidade de hashes
// POST ?run=<TOKEN>  {sha, tipo, b64}  -> sobe 1 arquivo, devolve a url no app
// POST ?troca=<TOKEN> [{id, foto}]      -> troca ProductTemplate.foto, so se a foto
//                                          atual for hotlink de uma das 5 origens e
//                                          a nova for arquivo do proprio app

import { createClientFromRequest } from "npm:@base44/sdk@0.8.41";

const BUILD = "2026-10-10-hotlinks-v2-troca";
const TOKEN = "pf-hotlinks-2026-10-10-b93e07d2";
const TIPOS: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };

const PERMITIDOS = new Set<string>(`
014aadbd58a00abf19f48083317acfa8d9bd470114dd0a3719e06f681c60f3c2 02088aee05d42f05be54d6582e4eb8ae40edacee49857600409c2e014c049e90 026433019facf17ec92b502a3159356c916a74e36df66df65bbf405088540f98 050d328e814089c13ef9f939d5d5508e83d88e67ecbb95d4372e741c51daea6f 08806a62cd7665750c7d56fbcbf525729088863c8bdd2e05420329930874f118 09a584335bcc8a0788da59fb5fca55f216955e2a5dace4d0134e4f9f28427779 09e3bba30a78163defc78662a42eb0cc6590d0fb9e8ccddf9a862db79ca0e849 0bbdb5a45adf39ec1f0d7d25cd35125a7daa0dfee140868ba92566cf37aa603b 0f6bec2cf546081c5e15e568f482654308e08a5baa6ce8b24a89f40762648b90 15a5a98e35eb1bc76ef050ca8d5d4b7cd5c2f12b3bf5d7a9e0209fad9279618d 1639f7b47e5bdeda2050e535ecad19ccea21d217109ee6683432fbec4d4c7302 17101e60038f209198f4169a2706232fa2db17ab009d3200ff23221c8c84dd8f 17c14a0889c23060fbc54f66b8822bdf8b9567330afce695f0ec36a20aa779ec 18d71980da40e01363244e37e65caf0c664e5e07278355eba04f10e31a44758b 1aed19b333d835de528446907d4477f7b077f7bde956cd620df4abc5c8df99d2 1be978e7e5dd939aabebff85dfc3daa0705ebd083060534e8af4d6dfcaf66b86 1d6e6db54c5a62478e69af4286e25927a57848e61b936292c43cb9d3bf97c169 1f63358722a29f309c42519f2d09c5c57a55082140698c2756e6ba800ffd76f4 220f42e570eaae127f631da9b53585c843617a76fde32d6d995afca839db5145 2487482af04fc569e5ad7207a51deda7e631fd6ab9f3c017adc8c4d7d059fad3 25b3aa69e2344a52164795a9f1ef632c3b858d573cf6e79c615837efd400ec1d 25e5d510cb7e95073a5e49c715ec2aac27d6a9bc3df34f1e966ac56a4b1855ad 2645867ccaae4eb8e8a0ad66eeae3ba35b25b2bd91c395c490aca68958ea5697 274bc4fd3c8bc1480919505eb93f555dc1bbe1885d06b47f2fa01db1986dafc4 296940ebb7a89256ffe13a99665c5c47c229b5d53811c92ea06c2731a0e2d591 2b031ab5ee4fd405dfab267b62da5070c13044edf243e545f5cbacfd78a10e46 2b8e20cf363fa7c06acd3b87ec8d95219a721891c41a629152a2b0d65da8ad82 2c5e31474d821f45dffb838dad042ec8117da0fb0735ef643b9cdc5046431f6b 2ceb0315af69b43216b0767a725f9bcc255c011b5661923075c77160933d059a 2f2d9fb2d6f93ad2dfb6e4ab641c1723d57463e9d8d07bd623969ca0a8d47ef8 32c4728feb962fef858cbd846d1335251c34308e431fc696bf042e44f0a9b45c 32ee0fff4fb59df1919da492dc89b24e40606a5266bb1f1e230d54fee3cdad3e 3b2d8967053d17f8a63bdadb5e3fa7072ac9730a4e1770765975a8539294d6bf 3c9f0ddf73528f3b583de9ce28a8bb47c86d8b90f2b6684e451cf5ab5721fb29 3cb8107a85ef510d471082eb8189123e81ba750f491db54b9c7ec443c187ae80 3e4222b7ece8ea8333d41276c34f7b961502518e6de05614f3bb6f36a01203f7 40c14c7f09f8e71a757c6ab1301f6286c43d16045cbb3d72709f57af18a4e2b4 46b64258bdc5d6cd43678f5e8503f2b9e544395243fe650fca85ad8980829f3b 47db7fb354fda994f6daf99385e80346f46066c0b534c8979046d77ebfff7be1 4bf6a8af5271ba5e8a82ffb9af39b4b3c3be1a3c87124c50c77ec3ef1033311e 4fb33676393498d70102a0c88f64687109c62665033b6057fbdc76c0edbc78ff 5082dd13345a3a744ea6e28101efed71e34e8f31193d4cbba44bdfa7e48b7132 50c2d49456aab7e21ab996c7d6d3a1b5aadc4797ae61662828acdab9e3388416 543bfa842df43a578a9d5dc2f9d7a58f2ab2948ec31b6377d0fc9a89ed4814cf 56a64f972ef068d5ae28b7d0e34870d885d2693787a75b8d6090f39f9ff3a1ab 58ea124710daf34a955537c3d3f765dd512dbd4daf12bd9194b139fbae28eb1e 5f2e0986080ba8686c32960cf303312866fa70ab0dbfe4dd07e46320b0909399 61f42808ef4c455c6073731fcc6683bfc2730980db370361c5dff1adf977dcca 6926d87614469dd1cf8d5b19322cdbd63d76632cbd28b6be2a4fc3e77a3560d2 6ac0af59157a0e037ba935bfadd9ac9e0a5413277051db30c70da8a46fc93eda 6b6fe0fad440bd247599e9c7b093b30888c352c284c0cddf73d92cbf17136e0e 6d0695bc8f267995be69949dd91d64d208083d3aaad96915e36e83bbbd7daf80 6fd269434f2df6dfa69019283453f7b7b78e04c0e6fbcdeaa433984f8c3d794c 74886fa8e09a03374ef4201a0a76920dcf2c5d395d84901f8cc409de7ddfcaf4 74b142f129d3029f64f2047c04274de6209b24e67b8748d9a1425258bfdae25c 74ffb329631d486c45c58865b7b5c1ca6b7ec6f0c5c8e1a20b59590c6c2f01d6 769f1443a8b7e8a1c9dbf9cf0aaddc960c26693a482065c0f26e6558b99ef5e8 7902ee7966b05cf1744429a245cecbd4304f2c0f2e241b6c70ead9c8519fb027 79f9870aad649370dcdd30bc7b247af3297a02eb5c8803e8e3fc09cad2abd925 7b94bcfa268af285bdf2c25fbc65eb4b5ab0a8e0cd96e99639fbde6fea5a40ed 7e188c245713716d87e4d08ead8448802ef82ebbb52aed4d3dbe5218e2698b79 81f40bb8322af40f451308b9f39f7f0c2112ab6a7aa6dc7efd1b616d91ba026a 830a5a5133c22844a7c6bdf99ad26de2f3c211c6b2fb4bb9b1e1d7c8aacaaa31 84a1489a34ca61c41ab31e209c14fe2b3cd15368fd26c8441f3c5e2940f27266 897244f2730fcb2acf4ee9049e06ca64f1e4631009b7c679b4f2893a822195e6 8d1e344f6465b686d28d369d3e9073f6682a1b03ace5b2188197c1abee6efc5b 909fbe1e98674c1beae7b05d58d78b527caa33e24c14b5ee3dfb62e298620c42 915f62d42a0e7eac01800a6a8d3a4ae1908ba4159bad33daa5a7412601d98fbf 91abe89f144e7641c68d56d9e428a5ce5ba6daaa02b8d2b80ae61904bf641802 92a4539adcd8049413ce462233a61fab1e0bd4e768e936169c381812a69ec6d7 9794318aca8fb1f42a7a38aed842fab95ac7ac8f9e3737ffb1dde50f43343d84 9ab27b0ee5454d7c342efc597a2a059cd0a16b3e3c4eafcb2f2935dd38468eed 9b52f212bbfacf7b5ac2d0f7a401588c83861b85615713323ea8f60fae89e29e 9c136881c30591dbae3ef3885cdd868c22c9eebad20a78501c80e33a6ec239c6 9d4b47505ce5054d85e22fe1a543d5b7254d01257578201b1b968b40bace019d 9de3c0158716b83fb5fcdffd18de46e95c0a533998f11418640695b2811854aa 9e947350b73539ee71ad99c203379b04d125802f3a2b06a3b175a2d7feca54f2 9e9bd63cf8d8a63e1b81f70d312f9f3676d1358d29b1959620187e75e6a0160d a287f1413ead1a3394b12f39725e68e7578c91d14c4026b90ad70bf8b043e22c a32877d12954eef2fe739b47b007fc818244bcc5bd5204ff35fece63fcf8cd83 ac5804d8703a911c483c456bbfde6defce61dd67418204016fb0fc0bc3dd959c ad60972ef4adc6444357200d7eead5f6f0a4082a08e6c4f9696418d318a7b403 b18e4c588417ed0d4d1a494507e004d37942302112716c650a4a1929afddef20 b366718e642e46a0cd91a45e82e5dc90c207f6d716893ce91091da6e757896cf b749aa7a8d9c17624867e799fba451c9133134fdda721bb953f336919e068fbd baa8ec35aabe3c080c56f897e409e0f57ff129b1df5134c11fe123cade85118a bd141749d230c4fcc23c244bf849b768f3a2150715254e30d0fcef5eb1a48d6a be25dbad5a8669b3d256deedd9d65ef14b0540ebae691c2e64092eaaad93d88f bf33d19f33e13a3221aea4a284dfd0bec4b50b7299a6bdea8ee8a74d71fb31e3 c60ec2e1bd95b7cbd7dbaf2752f61d704665bc135b34ca8105bfc6e3883d211e c950055f9e57bd765582e3250284bcd945daa5909979c1dd58ec915deb942bc0 ca9ab1fa174d1e18bcd7cc5013431bf4223a8db77a3094c8b57c9e894e51e5ca cacb9086dd85bcf54a3c42c86b3357ab5c44ed138726274c16c0e1029bea11a3 cc12d166051788ef9c1a89751ad9f3316b4238f159893c2929ceabae30804394 cd945f5204df69a3ba118d831580af7e783a57f1cf5c4f24ab141e8c1e0640fd d51242de7c95b33fc30b601f308c16ed398cc803b4d4454b4686599c26a765a5 d5ffbbb1d48e864e6b162e83921b1457c7c4415401c918fb8f7d8db070d85067 dc982d11f03297bc7f74d9f162874aaa93f20175bcc8a15c70166c1e2a333053 e0c5302b922dd77a48cf1b9e9babc688f6a58a668a06aec5853335c398b687d1 e2a99b3bfd85b6bb684ba34cf37d764d5e4f2653633cb2b297135b2bb55f71d4 e2ca1d86ba4a0b08f9e8463b7866c28a4a055b61cb3b76b0cde9c153a96a27a2 e90ad15365232c876e5c2c3ba1906cb1fdc6c1b882a9a7f23231cf0afb17b6d1 e9699a8dee2301c2038ef0a9c29a8a7d6a21dc0c3220da3d2d763fe33b0137ec e96c24c3980456b579c331e12b25f65b3ab2268f65447c7e6cac807b21bf4d2d ebf1b4f654eb34b871fc9c5ec41663eb4795eb1e9f54d60fa1f008984c483767 eede35791d3b65e4aee66e0acdbc2d7de16de0453d80e08e2229a9c287861652 ef4ed0f2e8a901cfb427c8c2f518d13dc3dc903304305186d7a1d0897c324f5e ef4fc34333bada06e20a7022eb057bdbb4a7e169a9976020746afabf6f5b4c95 efa5b6bc3210c08255209a747940d599abefbdcad97eb79a6d8c2c9124d78136 efdb6778b949c9e14c1b6484b735d1d4fa43ecb8743b44269cd92fadfaca4213 f0381d9821fb03855035ca038320c8ac60a0593c0610d3b89f11887c830c2e4e f3bafa89e0bc0a293dc5f293742a9248c62f7aa6e108f620f1f2b2abda3f1e04 f457d2e5a1f5ce8cb2f6f7e97228a1aaa96a558088d6cf823c23f2b0d9fe5d6e f6a0002ec50c36ec0315bbf03b7422da593fecfc8a161783b01cb7c5a1c4e3cc f7f529a64571611142e8666643878636a9d69ed66cf17ff9e28ebc930f3ddbae f81f464878a1adf029de5e1ab88a2801b27febf3a24de2e1465b491c692b8993 fc3269f973774c0a3b72998b7da2149420bc3d7d8ce58fca47348c5121513afa fcb4db8868696003d7c857e48a9004c85d8942b3a87f04a23c8ab89748479101 feb380c361fba041e3af4951219028ba6c097f1aae56f454736d3b7449bc2ce9
`.trim().split(/\s+/));

const sha256 = async (b: Uint8Array) =>
  Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", b)))
    .map((x) => x.toString(16).padStart(2, "0")).join("");

const ORIGENS = ["anilhasehalteresbrasil.com.br", "haxfit.com.br", "metalformaadm.webtrafego.com.br", "img.irroba.com.br", "placefit.com.br"];
const PREFIXO_APP = "https://base44.app/api/apps/68c9d5dd3cf0f8fd8a834875/files/mp/public/68c9d5dd3cf0f8fd8a834875/";

const trocar = async (req: Request) => {
  const base44 = createClientFromRequest(req);
  const itens: { id: string; foto: string }[] = await req.json();
  const out = { trocados: 0, pulados: [] as unknown[] };
  for (const { id, foto } of itens) {
    if (typeof foto !== "string" || !foto.startsWith(PREFIXO_APP)) { out.pulados.push({ id, motivo: "foto nova fora do app" }); continue; }
    const [t] = await base44.asServiceRole.entities.ProductTemplate.filter({ id });
    const host = t?.foto ? new URL(t.foto).hostname : "";
    if (!t || !ORIGENS.includes(host)) { out.pulados.push({ id, motivo: `foto atual nao e hotlink (${t?.foto ?? "sem registro"})` }); continue; }
    await base44.asServiceRole.entities.ProductTemplate.update(id, { foto });
    out.trocados++;
    await new Promise((r) => setTimeout(r, 250));
  }
  return Response.json(out);
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  if (url.searchParams.get("info")) return Response.json({ build: BUILD, hashes: PERMITIDOS.size });
  if (req.method === "POST" && url.searchParams.get("troca") === TOKEN) return trocar(req);
  if (req.method !== "POST" || url.searchParams.get("run") !== TOKEN) {
    return Response.json({ error: "token" }, { status: 403 });
  }
  const { sha, tipo, b64 } = await req.json();
  if (!PERMITIDOS.has(sha) || !TIPOS[tipo]) return Response.json({ error: "nao permitido" }, { status: 400 });

  const bytes = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
  const hash = await sha256(bytes);
  if (hash !== sha) return Response.json({ error: "hash diferente", hash }, { status: 400 });

  const base44 = createClientFromRequest(req);
  const file = new File([bytes], `foto_${sha.slice(0, 16)}.${TIPOS[tipo]}`, { type: tipo });
  const up = await base44.asServiceRole.integrations.Core.UploadFile({ file });
  return Response.json({ sha, url: up.file_url, bytes: bytes.length });
});
