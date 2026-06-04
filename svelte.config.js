import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	compilerOptions: {
		// Force runes mode for the project, except for libraries. Can be removed in svelte 6.
		runes: ({ filename }) => (filename.split(/[/\\]/).includes('node_modules') ? undefined : true)
	},
	kit: {
		// Static build for GitHub Pages.
		adapter: adapter({
			pages: 'build',
			assets: 'build',
			fallback: '404.html'
		}),
		// Base path is injected by the deploy workflow (BASE_PATH=/RedDeviz);
		// empty in local dev.
		paths: {
			base: process.env.BASE_PATH ?? ''
		}
	}
};

export default config;
