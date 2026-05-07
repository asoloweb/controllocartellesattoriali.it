const DIRECTUS_URL = (env) =>
	(env.PUBLIC_DIRECTUS_URL || env.DIRECTUS_URL || 'https://controllocartellesattoriali.asoloweb.it').replace(
		/\/+$/,
		''
	);

function jsonResponse(status, body) {
	return new Response(JSON.stringify(body), {
		status,
		headers: { 'Content-Type': 'application/json' },
	});
}

async function directusRequest(env, path, options = {}) {
	const url = `${DIRECTUS_URL(env)}${path}`;
	const headers = {
		Authorization: `Bearer ${env.DIRECTUS_TOKEN}`,
		'Content-Type': 'application/json',
		...(options.headers || {}),
	};
	return fetch(url, { ...options, headers });
}

export async function onRequestPost({ request, env }) {
	if (!env.DIRECTUS_TOKEN) {
		return jsonResponse(500, { error: 'Missing DIRECTUS_TOKEN' });
	}

	const body = await request.json().catch(() => ({}));
	const email = String(body?.email || '').trim().toLowerCase();
	const telefono = String(body?.telefono || '').trim();
	const privacy = String(body?.privacy || '').trim().toLowerCase();
	if (!email || !telefono || privacy !== 'si') {
		return jsonResponse(400, { error: 'Missing required fields' });
	}

	const contatto =
		String(body?.contatto || '').trim() ||
		[`Email: ${email}`, `Telefono: ${telefono}`, 'Consenso privacy: si'].join('\n');

	const richiestaResponse = await directusRequest(env, '/items/richieste', {
		method: 'POST',
		body: JSON.stringify({ contatto }),
	});

	if (!richiestaResponse.ok) {
		const err = await richiestaResponse.text();
		return jsonResponse(500, { error: 'Richiesta creation failed', detail: err });
	}

	const richiestaData = await richiestaResponse.json();

	return jsonResponse(200, {
		richiesta_id: richiestaData?.data?.id,
	});
}
