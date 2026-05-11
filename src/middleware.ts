import type { MiddlewareHandler } from 'astro';

const fallbackSiteUrl = 'https://controllocartellesattoriali.it';

function getCanonicalOrigin() {
	const raw = (import.meta.env.PUBLIC_SITE_URL || fallbackSiteUrl).trim();
	try {
		return new URL(raw).origin;
	} catch {
		return fallbackSiteUrl;
	}
}

export const onRequest: MiddlewareHandler = async (context, next) => {
	const requestUrl = context.url;
	const host = requestUrl.hostname.toLowerCase();
	const isLocalhost =
		host === 'localhost' || host === '127.0.0.1' || host === '::1' || host.endsWith('.local');

	if (!import.meta.env.PROD || isLocalhost || import.meta.env.DEV) {
		return next();
	}

	const canonicalOrigin = getCanonicalOrigin();
	const canonicalHost = new URL(canonicalOrigin).hostname;
	const isWwwHost = host.startsWith('www.');
	const isWrongHost = host !== canonicalHost;

	if (isWwwHost || isWrongHost) {
		const redirectUrl = new URL(requestUrl.pathname + requestUrl.search, canonicalOrigin);
		return context.redirect(redirectUrl.toString(), 301);
	}

	return next();
};
