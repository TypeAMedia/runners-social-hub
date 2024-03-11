class App {
	constructor() {
		this.zoomExtent = [0.9, 8]
		this.currentScale = 1
		this.zoomStep = 0.5

		this.loadDataAndInit()

		let timer = null

		d3.select(window).on('resize.map', () => {
			if (timer) clearTimeout(timer)
			timer = setTimeout(() => {
				this.map?.resize()
			}, 100)
		})
	}

	async loadDataAndInit() {
		try {
			const [mapjson, data] = await Promise.all([
				d3.json('./data/uk-outline-topo.json'),
				d3.csv('./data/social-hub-data.csv', d3.autoType),
			])

			this.data = data

			this.choice = initDropdown({
				searchPlaceholderValue: 'Search',
				placeholder: 'Find your Town / city',
				list: data.slice()
					.sort((a, b) => {
						return d3.ascending(a.city, b.city)
					})
					.map(d => {
						return {
							label: d.city,
							value: d.city,
						}
					}),
				id: '#city_select',
				cb: city => {
					this.map.highlightPin(x => x.city === city)
				},
				searchEnabled: true,
			})

			this.map = new MercatorMap({
				container: '#map',
				basemap: mapjson,
				data: this.data,
				zoomExtent: this.zoomExtent,
				layer: data.map((d, i) => {
					const [Latitude, Longitude] = d.Coord.split(';').map(d => +d.trim())
					return {
						...d,
						// Rank: d['overall rank'],
						Latitude,
						Longitude,
					}
				}),
				getTooltipHtml: d => {
					return `
					<div class="tooltip-div">
						<h3 class="tooltip-title">${d.city}</h3>
						<div>
							<table class="table table-sm">
								<thead>
									<tr>
										<th>Factors</th>
										<th class="font-normal">#</th>
										<th class="font-normal">Rank</th>
									</tr>
								</thead>
								<tbody>
									${Object.values(config)
							.sort((a, b) => a.order - b.order)
							.map(conf => {
								return `
												<tr>
													<td>
														<div class="d-flex align-items-center">
															<div class="icon">${conf.icon}</div>
															<div class="${conf.fieldTeam === 'Overall rank' ? 'field-overall' : 'field-city'}">${conf.fieldTeam}</div>
														</div>
													</td>
													<td class="col-2">
														${formatThousand(d[conf.numberField]) !== undefined ? formatThousand(d[conf.numberField]) : ''}
													</td>
									<td class="${conf.fieldTeam === 'Overall rank' ? 'col-3-overall' : 'col-3'}">
										${ordinal_suffix_of(d[conf.rankField])}
									</td>
												</tr >
									`
							}).join('')}

			
								</tbody>
						</table>
						</div>
					</div>`
				},
				beforeRender: container => {
					const isMobile = window.innerWidth < 576
					const g = container
						.patternify({
							tag: 'g',
							selector: 'backgrounds',
						})
						.attr(
							'transform',
							`translate(${isMobile ? 35 : 80}, ${isMobile ? -30 : 0})`
						)
					g.patternify({
						tag: 'g',
						selector: 'img',
						// data: [
						// 	'./images/desktop-map-background.svg',
						// 	'./images/mobile-map-background.svg',
						// ],
					})
						.classed('d-mobile', d => {
							return d.includes('mobile')
						})
						.classed('d-desktop', d => {
							return d.includes('desktop')
						})
						.each(function (d) {
							loadSvg(d).then(res => d3.select(this).html(res))
						})
				},
				onPinClick: d => {
					this.choice.setChoiceByValue(d.city)
					this.map.highlightPin(x => x.Team === d.city)
				},
			})
			this.fillModal()
			this.initZoomBtns()
		} catch (e) {
			console.error(e)
		}
	}

	updateZoomBtns() {
		if (this.map) {
			d3.select('#zoom_in').property(
				'disabled',
				this.currentScale >= this.zoomExtent[1]
			)
			d3.select('#zoom_out').property(
				'disabled',
				this.currentScale <= this.zoomExtent[0]
			)
		}
	}

	initZoomBtns() {
		this.updateZoomBtns()

		d3.select('#zoom_in').on('click', () => {
			this.currentScale = Math.min(
				this.zoomExtent[1],
				this.currentScale + this.zoomStep
			)
			this.map && this.map.scale(this.currentScale)
			this.updateZoomBtns()
		})

		d3.select('#zoom_out').on('click', () => {
			this.currentScale = Math.max(
				this.zoomExtent[0],
				this.currentScale - this.zoomStep
			)

			this.map && this.map.scale(this.currentScale)
			this.updateZoomBtns()
		})

		d3.selectAll('.money-toggle').on('click', e => {
			const target = e.target.getAttribute('data-target')
			const field =
				target === 'with_money' ? 'RANK WITH BUDGET' : 'RANK NO BUDGET'

			this.rankField = field
			this.map && this.map.setColorBy(this.rankField)

			d3.selectAll('.money-toggle').classed('btn-active', false)
			d3.select(e.target).classed('btn-active', true)

			if (this.currentCountry) {
				this.selectCountry(this.currentCountry)
			}
		})
	}

	// ${conf.fieldTeam ? `<th>${conf.label}</th>` : ''}
	fillModal() {
		const table = d3.select('#table')
		const fill = conf => {
			table.html(`
						<tr>
							<th class='table-color'>Rank</th>
							<th class='table-color'>Town / City</th>
						</tr>
						<tbody>
							${this.data
					.slice()
					.filter(d => !isNaN(d[conf.rankField]))
					.sort((a, b) => {
						return a[conf.rankField] - b[conf.rankField]
					})
					.map(d => {
						return `
									<tr>
										<td class='rank-table'>${ordinal_suffix_of(d[conf.rankField])}</td>
										<td class='rank-table-city'>${d.city}</td>			
									</tr>
								`
					})
					.join('')
				}
						</tbody>
					`)
		}

		fill(config.overall)

		d3.selectAll('.rank-btn').on('click', (e, d) => {
			const target = e.target.getAttribute('data-target')
			d3.selectAll('.rank-btn').classed('btn-active', false)
			d3.select(e.target).classed('btn-active', true)
			fill(config[target])
		})
	}
}

document.addEventListener('DOMContentLoaded', () => {
	const app = new App()
	window.app = app
})
