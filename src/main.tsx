import { render } from 'preact'
import { App } from './ui/app.tsx'
import './ui/styles.css'

const root = document.getElementById('app')
if (!root) throw new Error('#app element missing from index.html')
render(<App />, root)
