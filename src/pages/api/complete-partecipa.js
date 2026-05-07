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
	const directusToken = env.DIRECTUS_TOKEN || env.PUBLIC_DIRECTUS_TOKEN;
	const headers = {
		Authorization: `Bearer ${directusToken}`,
		'Content-Type': 'application/json',
		...(options.headers || {}),
	};
	return fetch(url, { ...options, headers });
}

function parseRawBody(rawText, contentType) {
	if (!rawText) return {};
	const lowerType = (contentType || '').toLowerCase();
	if (lowerType.includes('application/json')) {
		try {
			return JSON.parse(rawText);
		} catch {
			return {};
		}
	}
	if (lowerType.includes('application/x-www-form-urlencoded')) {
		const params = new URLSearchParams(rawText);
		const result = {};
		for (const [key, value] of params.entries()) result[key] = value;
		return result;
	}
	try {
		return JSON.parse(rawText);
	} catch {
		const params = new URLSearchParams(rawText);
		const result = {};
		for (const [key, value] of params.entries()) result[key] = value;
		return result;
	}
}

export const prerender = false;

async function handleRequest(request, env) {
	if (!env.DIRECTUS_TOKEN && !env.PUBLIC_DIRECTUS_TOKEN) {
		return jsonResponse(500, { error: 'Missing DIRECTUS_TOKEN' });
	}

	const contentType = request.headers.get('content-type') || '';
	const rawText = await request.text();
	const body = parseRawBody(rawText, contentType);
	const requestUrl = request.url || '';
	const urlParams = (() => {
		try {
			return new URL(requestUrl).searchParams;
		} catch {
			return new URLSearchParams('');
		}
	})();

	if (Object.keys(body || {}).length === 0 && urlParams.toString()) {
		for (const [key, value] of urlParams.entries()) {
			if (body[key] === undefined) body[key] = value;
		}
	}

	const email = String(body?.email || '').trim().toLowerCase();
	const telefono = String(body?.telefono || '').trim();
	const privacy = String(body?.privacy || '').trim().toLowerCase();

	if (!email || !telefono || privacy !== 'si') {
		return jsonResponse(400, {
			error: 'Missing required fields',
			received: {
				content_type: contentType,
				content_length: request.headers.get('content-length') || '',
				body_length: rawText.length,
				has_email: !!body?.email,
				has_telefono: !!body?.telefono,
				has_privacy: !!body?.privacy,
				request_url: requestUrl,
				query: urlParams.toString(),
			},
		});
	}

	const contatto =
		String(body?.contatto || '').trim() ||
		[`Email: ${email}`, `Telefono: ${telefono}`, 'Consenso privacy: si'].join('\n');
	const dataRichiesta = new Date().toISOString();

	const richiestaResponse = await directusRequest(env, '/items/richieste', {
		method: 'POST',
		body: JSON.stringify({
			email,
			telefono,
			privacy,
			data_richiesta: dataRichiesta,
			contatto,
		}),
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

export async function POST({ request, locals }) {
	const runtimeEnv = locals?.runtime?.env;
	const env = runtimeEnv || import.meta.env || process.env;
	return handleRequest(request, env);
}

export async function GET({ request, locals }) {
	const runtimeEnv = locals?.runtime?.env;
	const env = runtimeEnv || import.meta.env || process.env;
	return handleRequest(request, env);
}
