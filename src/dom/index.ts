import { drawZoneForElement, setupCanvas } from './CanvasElement'
import { DisposableStore, MappedView } from '$/utils'
import { Clock } from './Clock'
import { Rotary } from './Rotary'
import { Toggle } from './Toggle'

const disposables = new DisposableStore()

const HOUR = 1000 * 60 * 60
const DAY = HOUR * 24
const YEAR = DAY * 365

const canvas = document.querySelector('canvas')
const main = document.getElementById('main')
const config = document.getElementById('config')

if (!(canvas && main && config)) {
	throw Error('bad DOM, elements not found')
}

const makeConfigArea = (className: string, parent: HTMLElement = config) => {
	const el = parent.appendChild(document.createElement('div'))
	el.className = className
	return el
}

const showSecondsEl = makeConfigArea('toggle')
const enableTimerEl = makeConfigArea('toggle')
const fMaxEl = makeConfigArea('rotary')

const go = () => {
	disposables.clear()

	const { ctx, dim } = setupCanvas(canvas)

	// Background
	ctx.fillStyle = '#889'
	ctx.fillRect(dim.left, dim.top, dim.width, dim.height)

	const mainDrawZone = drawZoneForElement(main)
	console.log(mainDrawZone)

	const clockSize = mainDrawZone.minDim * (6 / 7)
	const clock = new Clock(
		ctx,
		{
			left: mainDrawZone.centerX - clockSize / 2,
			top: mainDrawZone.centerY - clockSize / 2,
			width: clockSize,
			height: clockSize,
		},
		{
			label: 'Time',
			time: Date.now(),
			offset: 0,
			timeRate: 1,
			render60Count: true,
			renderSecondHand: true,
			render12Count: true,
			enableTimer: true,
			fMax: 1 / 60,
		},
	)

	const configDrawZone = drawZoneForElement(config)

	ctx.strokeStyle = '#000'
	ctx.lineWidth = 8

	ctx.beginPath()
	ctx.fillStyle = '#333'
	ctx.roundRect(
		configDrawZone.left,
		configDrawZone.top,
		configDrawZone.width,
		configDrawZone.height,
		(configDrawZone.minDim * 1) / 4,
	)
	ctx.stroke()
	ctx.fill()

	const secondToggle = new Toggle(ctx, drawZoneForElement(showSecondsEl), {
		label: 'Seconds',
		onLabel: 'Show',
		offLabel: 'Hide',
		value: true,
	})

	const timerToggle = new Toggle(ctx, drawZoneForElement(enableTimerEl), {
		label: 'Timer',
		onLabel: 'Enable',
		offLabel: 'Disable',
		value: true,
	})

	const fMaxRotary = new Rotary(ctx, drawZoneForElement(fMaxEl), {
		label: '\u0192 MAX',
		subtitle: 'Hz',
		minAngle: -200,
		maxAngle: 20,
		selectedIndex: 2,
		values: ['1', '10', '20', '30', '\u221e'],
	})
	clock.viewInput(
		'fMax',
		MappedView(
			fMaxRotary.selectedIndexView,
			(i) => [1, 1 / 10, 1 / 20, 1 / 30, 1 / 60][i],
		),
	)

	clock.viewInput('renderSecondHand', secondToggle.valueView)
	clock.viewInput('enableTimer', timerToggle.valueView)

	const allComponents = [clock, secondToggle, timerToggle, fMaxRotary]

	disposables.add(...allComponents)
	allComponents.map((c) => c.render())
}

window.addEventListener('resize', go)
window.addEventListener('hashchange', go)
window.addEventListener('unload', () => {
	disposables.dispose()
})
go()
