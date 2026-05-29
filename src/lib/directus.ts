const rawDirectusUrl =
	import.meta.env.PUBLIC_DIRECTUS_URL ||
	import.meta.env.DIRECTUS_URL ||
	'https://controllocartellesattoriali.asoloweb.it';

export const DIRECTUS_URL = rawDirectusUrl.replace(/\/+$/, '');

type AssetTransformOptions = {
	width?: number;
	height?: number;
	quality?: number;
	format?: 'webp' | 'avif' | 'jpg' | 'png';
	fit?: 'cover' | 'contain' | 'inside' | 'outside';
};

export function directusItemsUrl(path: string) {
	const cleanedPath = path.replace(/^\/+/, '');
	return new URL(`/items/${cleanedPath}`, DIRECTUS_URL);
}

export function directusAssetUrl(asset: string, options: AssetTransformOptions = {}) {
	if (!asset) return '';
	if (asset.startsWith('http://') || asset.startsWith('https://') || asset.startsWith('/')) {
		return asset;
	}

	const url = new URL(`/assets/${asset}`, DIRECTUS_URL);
	if (options.format) url.searchParams.set('format', options.format);
	if (options.quality) url.searchParams.set('quality', String(options.quality));
	if (options.width) url.searchParams.set('width', String(options.width));
	if (options.height) url.searchParams.set('height', String(options.height));
	if (options.fit) url.searchParams.set('fit', options.fit);
	return url.toString();
}
