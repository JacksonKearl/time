import { wrap } from '$/degreeMath'
import { DisposableStore, LocalStorageState, scale, View } from '$/utils'
import { CanvasElement, DrawZone, Location } from './CanvasElement'

type ClockOptions = {
	label: string
	time: number
	offset: number
	timeRate: number
	renderSecondHand: boolean
	render60Count: boolean
	render12Count: boolean
	fMax: number
	enableTimer: boolean
}

export class Clock extends CanvasElement {
	private autoAdvanceDisposables = new DisposableStore()
	private isReset: (l: Location) => boolean = () => false
	private isStart: (l: Location) => boolean = () => false

	private timerStartStore: LocalStorageState<number | undefined>

	constructor(
		context: CanvasRenderingContext2D,
		drawZone: DrawZone,
		private options: ClockOptions,
	) {
		super(context, drawZone)
		this.scaleFactor = this.dimensions.minDim * (4 / 9)
		this.resetAutoAdvanceTimer()

		this.timerStartStore = new LocalStorageState<number | undefined>(
			options.label,
			undefined,
		)
		this.disposables.add(this.autoAdvanceDisposables, this.timerStartStore)
	}

	public viewInput<N extends keyof ClockOptions>(
		inputName: N,
		view: View<ClockOptions[N]>,
	) {
		const toRunOnChange: {
			[K in keyof ClockOptions]?: () => void
		} = {
			fMax: () => {
				this.resetAutoAdvanceTimer()
			},
			timeRate: () => {
				this.resetAutoAdvanceTimer()
			},
			renderSecondHand: () => {
				this.resetAutoAdvanceTimer()
			},
		}

		this.disposables.add(
			view((v) => {
				if (this.options[inputName] !== v) {
					this.options[inputName] = v
					requestAnimationFrame(() => {
						this.render()
					})
					toRunOnChange[inputName]?.()
				}
			}),
		)
	}

	protected override onClick(l: Location): void {
		if (this.isStart(l)) {
			this.timerStartStore.value = Date.now()
			this.render()
		}
		if (this.isReset(l)) {
			this.timerStartStore.value = undefined
			this.render()
		}
	}

	// reads: timeRate, refreshTimeout
	private resetAutoAdvanceTimer() {
		this.autoAdvanceDisposables.clear()
		const timeout = this.options.renderSecondHand
			? this.options.fMax
			: Math.min(1 / 10, this.options.fMax)

		const onFrame = () => {
			this.render()
			this.resetAutoAdvanceTimer()
		}

		if (timeout < 20) {
			const handle = window.requestAnimationFrame(onFrame)
			this.autoAdvanceDisposables.add({
				dispose: () => window.cancelAnimationFrame(handle),
			})
		} else {
			const handle = window.setTimeout(onFrame, timeout)
			this.autoAdvanceDisposables.add({
				dispose: () => window.clearTimeout(handle),
			})
		}
	}

	render(): void {
		this.context.save()

		const currentTime = new Date()
		if (this.options.fMax > 1 / 20) {
			const exact = currentTime.getMilliseconds()
			const batching = 1000 * this.options.fMax
			currentTime.setMilliseconds(Math.floor(exact / batching) * batching)
		}
		const timezoneOffset = this.options.offset * 60 * 1000
		const timeToShow = +currentTime - timezoneOffset
		const startOfDayInTimezone = new Date(timeToShow)

		startOfDayInTimezone.setHours(0, 0, 0, 0)
		const offset = timeToShow - +startOfDayInTimezone
		const seconds = offset / 1000
		const minutes = seconds / 60
		const hours = minutes / 60

		const timerStart = this.timerStartStore.value
		const timerSeconds = timerStart
			? (+currentTime - timerStart) / 1000
			: undefined
		const timerMinutes = timerSeconds ? timerSeconds / 60 : undefined

		const renderCasing = () => {
			this.context.strokeStyle = '#000'
			this.context.lineWidth = 8

			this.context.beginPath()
			this.context.fillStyle = '#333'
			this.context.roundRect(
				this.dimensions.left,
				this.dimensions.top,
				this.dimensions.width,
				this.dimensions.height,
				this.scaleFactor * 0.25,
			)
			this.context.stroke()
			this.context.fill()

			this.context.beginPath()
			this.setLineWidth(0.1)
			this.context.fillStyle = '#181818'
			this.traceCircle(1)
			this.context.stroke()
			this.context.fill()

			this.context.beginPath()
			this.context.fillStyle = '#000'
			this.traceCircle(0.85)
			this.context.fill()

			this.context.beginPath()
			this.context.fillStyle = '#222'
			this.traceCircle(0.83)
			this.context.fill()

			if (this.options.enableTimer) {
				this.context.beginPath()
				this.context.fillStyle = '#5a5555'
				this.context.strokeStyle = '#222'
				this.setLineWidth(0.01)
				this.isReset = this.traceCircle(0.2, -0.85, 0.85)
				this.context.fill()
				this.context.stroke()

				this.context.beginPath()
				this.context.fillStyle = '#555a55'
				this.context.strokeStyle = '#222'
				this.setLineWidth(0.01)
				this.isStart = this.traceCircle(0.13, 0.86, -0.86)
				this.context.fill()
				this.context.stroke()
			}
		}
		const render12Count = () => {
			this.context.fillStyle = '#fff'
			Array.from({ length: 12 }, (_, i) => i + 1).forEach((h) => {
				const r = 0.68
				const deg = scale(h, 0, 12, 90, -270)
				const { x, y } = this.getRect(r, deg)
				this.context.font = this.scaleFactor * 0.2 + 'px system-ui'
				this.fillText(x, y, String(h))
			})
		}
		const render60Count = () => {
			Array.from({ length: 12 }, (_, i) => i + 1).forEach((s) => {
				const r = 0.95
				const deg = scale(s, 0, 12, 90, -270)
				const { x, y } = this.getRect(r, deg)
				this.context.font = this.scaleFactor * 0.07 + 'px system-ui'
				const displayNumber = s * 5
				const rotation: Record<number, number> = {
					5: -30,
					10: -60,
					20: 60,
					25: 30,
				}
				this.withRotation(rotation[displayNumber % 30] ?? 0, x, y, () => {
					this.fillText(x, y, String(displayNumber))
				})
			})
		}
		const render60Icons = () => {
			this.context.strokeStyle = '#fff'
			this.context.fillStyle = '#fff'
			Array.from({ length: 60 }, (_, i) => i + 1).forEach((s) => {
				const deg = scale(s, 0, 60, 90, -270)
				if (s % 60 === 0) {
					this.context.beginPath()
					this.moveTo(0, -0.85)
					this.traceLine(0.04, -0.915)
					this.traceLine(-0.04, -0.915)
					this.traceLine(-0, -0.85)
					this.context.fill()
				} else if (s % 15 === 0) {
					this.context.beginPath()
					this.setLineWidth(0.05)
					this.traceRay(0.9, deg, 0, 0, 0.85)
					this.context.stroke()
				} else if (s % 5 === 0) {
					const { x, y } = this.getRect(0.875, deg)
					this.context.beginPath()
					this.traceCircle(0.025, x, y)
					this.context.fill()
				} else {
					this.context.beginPath()
					this.setLineWidth(0.02)
					this.traceRay(0.9, deg, 0, 0, 0.85)
					this.context.stroke()
				}
			})
		}
		const renderHourHand = () => {
			const hourAngle = scale(wrap(hours, 12), 0, 12, 90, -270)
			const rHour = 0.55
			this.withRotation(hourAngle, 0, 0, () => {
				this.context.fillStyle = '#444'
				this.context.strokeStyle = '#000'
				this.setLineWidth(0.015)

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.1)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceLine(rHour * (0 / 3), rHour * (1 / 30))
				this.traceLine(rHour * (2 / 3), rHour * (5 / 30))
				this.traceLine(rHour * (3 / 3), rHour * (0 / 30))
				this.traceLine(rHour * (2 / 3), rHour * (-5 / 30))
				this.traceLine(rHour * (0 / 3), rHour * (-1 / 30))
				this.traceLine(0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.fillStyle = '#fff'
				this.context.beginPath()
				this.traceLine(rHour * (1 / 3), rHour * (3 / 30))
				this.traceLine(rHour * (2 / 3), rHour * (5 / 30))
				this.traceLine(rHour * (3 / 3), rHour * (0 / 30))
				this.traceLine(rHour * (2 / 3), rHour * (-5 / 30))
				this.traceLine(rHour * (1 / 3), rHour * (-3 / 30))
				this.context.fill()

				this.context.fillStyle = '#444'
				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.1)
				this.context.fill()
			})
		}
		const renderMinuteHand = () => {
			const minuteAngle = scale(wrap(minutes, 60), 0, 60, 90, -270)
			const rMinute = 0.79
			this.withRotation(minuteAngle, 0, 0, () => {
				this.context.fillStyle = '#444'
				this.context.strokeStyle = '#000'
				this.setLineWidth(0.015)

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.08)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceLine(rMinute * (0 / 3), rMinute * (1 / 40))
				this.traceLine(rMinute * (2 / 3), rMinute * (3 / 40))
				this.traceLine(rMinute * (3 / 3), rMinute * (0 / 40))
				this.traceLine(rMinute * (2 / 3), rMinute * (-3 / 40))
				this.traceLine(rMinute * (0 / 3), rMinute * (-1 / 40))
				this.traceLine(0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.fillStyle = '#fff'
				this.context.beginPath()
				this.traceLine(rMinute * (1 / 4), rMinute * (5 / 3 / 40))
				this.traceLine(rMinute * (2 / 3), rMinute * (3 / 40))
				this.traceLine(rMinute * (3 / 3), rMinute * (0 / 40))
				this.traceLine(rMinute * (2 / 3), rMinute * (-3 / 40))
				this.traceLine(rMinute * (1 / 4), rMinute * (-(5 / 3) / 40))
				this.context.fill()

				this.context.fillStyle = '#444'
				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.08)
				this.context.fill()
			})
		}
		const renderTimer = () => {
			const timerAngle = scale(wrap(timerMinutes ?? 0, 60), 0, 60, 90, -270)
			const rTimer = 0.83
			this.withRotation(timerAngle, 0, 0, () => {
				this.context.fillStyle = '#444'
				this.context.strokeStyle = '#000'
				this.setLineWidth(0.015)

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.06)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceLine(rTimer * (0 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (5 / 80))
				this.traceLine(rTimer * (7 / 7), rTimer * (0 / 40))
				this.traceLine(rTimer * (6 / 7), rTimer * (-5 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (-1 / 80))
				this.traceLine(rTimer * (0 / 7), rTimer * (-1 / 80))
				this.traceLine(0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.context.fillStyle = '#fff'
				this.traceLine(rTimer * (5 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (1 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (5 / 80))
				this.traceLine(rTimer * (7 / 7), rTimer * (0 / 40))
				this.traceLine(rTimer * (6 / 7), rTimer * (-5 / 80))
				this.traceLine(rTimer * (6 / 7), rTimer * (-1 / 80))
				this.traceLine(rTimer * (5 / 7), rTimer * (-1 / 80))
				this.context.fill()

				this.context.fillStyle = '#444'
				this.context.beginPath()
				this.moveTo(0, 0)
				this.traceCircle(0.06)
				this.context.fill()
			})
		}
		const renderSecondHand = () => {
			this.context.beginPath()
			this.moveTo(0, 0)
			this.setLineWidth(0.015)
			const secondsToRender = this.options.enableTimer
				? timerSeconds ?? seconds
				: seconds
			const secondAngle = scale(wrap(secondsToRender, 60), 0, 60, 90, -270)
			const rSecond = 0.92
			this.withRotation(secondAngle, 0, 0, () => {
				this.context.fillStyle = '#333'
				this.context.strokeStyle = '#000'

				const centerCircleDiameter = this.options.enableTimer ? 0.04 : 0.06
				this.context.beginPath()
				this.traceCircle(centerCircleDiameter + 0.02, -0.4, 0)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.traceCircle(centerCircleDiameter, 0, 0)
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.moveTo(rSecond * -(2 / 5), rSecond * (1 / 30))
				this.traceLine(rSecond * (5 / 5), rSecond * (1 / 120))
				this.traceLine(rSecond * (5 / 5), rSecond * -(1 / 120))
				this.traceLine(rSecond * -(2 / 5), rSecond * -(1 / 30))
				this.context.stroke()
				this.context.fill()

				this.context.beginPath()
				this.traceCircle(centerCircleDiameter + 0.02, -(2 / 5), 0)
				this.context.fill()

				this.context.beginPath()
				this.traceCircle(centerCircleDiameter, 0, 0)
				this.context.fill()

				this.context.fillStyle = '#fff'
				this.context.beginPath()
				this.moveTo(rSecond * (1 / 6), rSecond * (2 / 90))
				this.traceLine(rSecond * (6 / 6), rSecond * (1 / 120))
				this.traceLine(rSecond * (6 / 6), rSecond * -(1 / 120))
				this.traceLine(rSecond * (1 / 6), rSecond * -(2 / 90))
				this.context.fill()
			})
		}

		renderCasing()
		render60Icons()
		if (this.options.render12Count) {
			render12Count()
		}
		if (this.options.render60Count) {
			render60Count()
		}
		renderHourHand()
		renderMinuteHand()
		if (this.options.enableTimer) {
			renderTimer()
		}
		if (this.options.renderSecondHand) {
			renderSecondHand()
		}

		this.context.restore()
	}
}
