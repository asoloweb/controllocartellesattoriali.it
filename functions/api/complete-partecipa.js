const DIRECTUS_URL = (env) =>
	(env.PUBLIC_DIRECTUS_URL || env.DIRECTUS_URL || 'https://admin.controllocartellesattoriali.it').replace(
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

function leadResponse(richiestaId, deduplicated = false) {
	const validId = (typeof richiestaId === 'number' && Number.isSafeInteger(richiestaId) && richiestaId > 0) ||
		(typeof richiestaId === 'string' && (/^[1-9]\d*$/.test(richiestaId) ||
			/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(richiestaId)));
	if (!validId) return jsonResponse(502, { error: 'Invalid saved richiesta ID' });
	return jsonResponse(200, {
		richiesta_id: richiestaId,
		transaction_id: `richiesta-${richiestaId}`,
		...(deduplicated ? { deduplicated: true } : {}),
	});
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

export async function onRequestPost({ request, env }) {
	if (!env.DIRECTUS_TOKEN && !env.PUBLIC_DIRECTUS_TOKEN) {
		return jsonResponse(500, { error: 'Missing DIRECTUS_TOKEN' });
	}

	const body = await request.json().catch(() => ({}));
	const email = String(body?.email || '').trim().toLowerCase();
	const telefono = String(body?.telefono || '').trim();
	const privacy = String(body?.privacy || '').trim().toLowerCase();
	const origine = String(body?.origine || '').trim();
	const idempotencyKey = String(body?.idempotency_key || request.headers.get('x-idempotency-key') || '').trim();

	if (!email || !telefono || privacy !== 'si') {
		return jsonResponse(400, { error: 'Missing required fields' });
	}

	const contattoBase =
		String(body?.contatto || '').trim() ||
		[
			origine ? `ORIGINE: ${origine}` : '',
			`Email: ${email}`,
			`Telefono: ${telefono}`,
			'Consenso privacy: si',
			`Data richiesta: ${getRomeTimestamp()} (Europe/Rome)`,
		]
			.filter(Boolean)
			.join('\n');
	const contattoWithOrigin =
		origine && !/(^|\n)ORIGINE:/.test(contattoBase)
			? `ORIGINE: ${origine}\n${contattoBase}`
			: contattoBase;
	const contattoWithDate = /(^|\n)Data richiesta:/.test(contattoBase)
		? contattoWithOrigin
		: `${contattoWithOrigin}\nData richiesta: ${getRomeTimestamp()} (Europe/Rome)`;
	const contatto = idempotencyKey
		? contattoWithDate.includes(`ID richiesta: ${idempotencyKey}`)
			? contattoWithDate
			: `${contattoWithDate}\nID richiesta: ${idempotencyKey}`
		: contattoWithDate;

	const existingId = await findExistingByIdempotencyKey(env, idempotencyKey);
	if (existingId) {
		return leadResponse(existingId, true);
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

	const richiestaData = await richiestaResponse.json().catch(() => null);
	return leadResponse(richiestaData?.data?.id);
}
