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

function getRomeTimestamp() {
	return new Intl.DateTimeFormat('it-IT', {
		timeZone: 'Europe/Rome',
		year: 'numeric',
		month: '2-digit',
		day: '2-digit',
		hour: '2-digit',
		minute: '2-digit',
		second: '2-digit',
		hour12: false,
	}).format(new Date());
}

function getUtcIsoTimestamp() {
	return new Date().toISOString();
}

async function findExistingByIdempotencyKey(env, idempotencyKey) {
	if (!idempotencyKey) return null;

	const query = new URLSearchParams({
		'filter[contatto][_contains]': `ID richiesta: ${idempotencyKey}`,
		fields: 'id',
		limit: '1',
		sort: '-id',
	});

	const response = await directusRequest(env, `/items/richieste?${query.toString()}`, {
		method: 'GET',
	});

	if (!response.ok) return null;
	const data = await response.json().catch(() => null);
	return data?.data?.[0]?.id || null;
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
	const idempotencyKey = String(body?.idempotency_key || request.headers.get('x-idempotency-key') || '').trim();

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

	const contattoBase =
		String(body?.contatto || '').trim() ||
		[
			`Email: ${email}`,
			`Telefono: ${telefono}`,
			'Consenso privacy: si',
			`Data richiesta: ${getRomeTimestamp()} (Europe/Rome)`,
		].join('\n');
	const contattoWithDate = /(^|\n)Data richiesta:/.test(contattoBase)
		? contattoBase
		: `${contattoBase}\nData richiesta: ${getRomeTimestamp()} (Europe/Rome)`;
	const contatto = idempotencyKey
		? contattoWithDate.includes(`ID richiesta: ${idempotencyKey}`)
			? contattoWithDate
			: `${contattoWithDate}\nID richiesta: ${idempotencyKey}`
		: contattoWithDate;

	const existingId = await findExistingByIdempotencyKey(env, idempotencyKey);
	if (existingId) {
		return jsonResponse(200, { richiesta_id: existingId, deduplicated: true });
	}

	const dataRichiesta = getUtcIsoTimestamp();

	const richiestaResponse = await directusRequest(env, '/items/richieste', {
		method: 'POST',
		body: JSON.stringify({
			contatto,
			email,
			telefono,
			privacy,
			data_richiesta: dataRichiesta,
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
