const rawDirectusUrl =
	import.meta.env.PUBLIC_DIRECTUS_URL ||
	import.meta.env.DIRECTUS_URL ||
	'https://gsivalore.asoloweb.it';

export const DIRECTUS_URL = rawDirectusUrl.replace(/\/+$/, '');

export function directusItemsUrl(path: string) {
	const cleanedPath = path.replace(/^\/+/, '');
	return new URL(`/items/${cleanedPath}`, DIRECTUS_URL);
}
