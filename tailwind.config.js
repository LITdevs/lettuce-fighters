
/** @type {import('tailwindcss').Config} */
module.exports = {
	content: ["./views/**/*.{html,js,ejs}", "./public/**/*.{html,js,ejs}"],
	darkMode: 'class', // or 'media' or 'class'
	theme: {
		extend: {
			colors: {
				'primary': '#1E1E1E',
				'secondary': '#2E2E2E',
				'tertiary': '#3E3E3E',
				'spent': '#424747',
				'tooltip': '#545454',
				'hp': '#F24747',
				'accent': '#3B4433',
				'light': '#D1D1D1'
			}
		},
	},
	variants: {
		extend: {}
	},
	plugins: []
}