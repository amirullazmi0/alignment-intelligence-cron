const API_URL = process.env.COLLECTOR_API_URL ?? 'http://127.0.0.1:5003';
const INTERNAL_TOKEN = process.env.COLLECTOR_INTERNAL_TOKEN ?? '';

/**
 * Penerus permintaan ke backend collector.
 *
 * Ada dua alasan permintaan tidak dikirim langsung dari browser. Pertama,
 * `COLLECTOR_INTERNAL_TOKEN` disisipkan di sini sehingga tidak pernah sampai ke klien.
 * Kedua, respons diteruskan sebagai stream apa adanya, yang membuat SSE log tetap
 * mengalir baris demi baris alih-alih tertahan sampai run selesai.
 */
async function proxy(request: Request, context: { params: Promise<{ path: string[] }> }) {
    const { path } = await context.params;
    const search = new URL(request.url).search;
    const target = `${API_URL}/${path.join('/')}${search}`;

    const headers = new Headers();
    const contentType = request.headers.get('content-type');
    if (contentType) headers.set('content-type', contentType);
    const accept = request.headers.get('accept');
    if (accept) headers.set('accept', accept);
    if (INTERNAL_TOKEN) headers.set('x-internal-token', INTERNAL_TOKEN);

    const method = request.method;
    const body = method === 'GET' || method === 'HEAD' ? undefined : await request.arrayBuffer();

    let upstream: Response;
    try {
        upstream = await fetch(target, {
            method,
            headers,
            body,
            cache: 'no-store',
            // Tanpa ini, Node akan mengumpulkan seluruh body lebih dulu dan SSE berhenti
            // menjadi "langsung".
            // @ts-expect-error - opsi khusus undici, belum ada di tipe RequestInit
            duplex: 'half',
        });
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Backend collector tidak dapat dihubungi';
        return Response.json(
            { detail: `Backend collector tidak dapat dihubungi (${API_URL}). ${message}` },
            { status: 502 },
        );
    }

    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.delete('content-length');
    responseHeaders.delete('content-encoding');
    responseHeaders.delete('transfer-encoding');

    return new Response(upstream.body, {
        status: upstream.status,
        statusText: upstream.statusText,
        headers: responseHeaders,
    });
}

export const dynamic = 'force-dynamic';

export { proxy as GET, proxy as POST, proxy as PATCH, proxy as DELETE, proxy as PUT };
